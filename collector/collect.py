"""TY SWIPE - coletor da nuvem.
Roda no GitHub Actions. Lê os perfis de perfis.json, pega métricas reais do Instagram
(seguidores, views, curtidas, comentários, data), baixa as capas e a foto, e usa o Gemini
para transcrever e analisar (gancho, ângulo, estrutura) os vídeos novos. Gera os arquivos
estáticos que a tela do Swipe lê. Nada fica no PC: tudo é commitado no repositório.
"""
import asyncio
import base64
import json
import os
import re
import sys
from datetime import datetime, timezone, date
from pathlib import Path

import httpx
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "perfis.json").read_text(encoding="utf-8"))
PERFIS = [p.strip().lower().replace("@", "") for p in CFG["perfis"]]
NICHO = CFG.get("nicho", "Geral")

IG_SESSION = os.environ.get("IG_SESSION", "").strip()
GEMINI_KEY = os.environ.get("GEMINI_KEY", "").strip()
MAX_ANALYZE = int(os.environ.get("MAX_ANALYZE", "30") or "30")

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
BASE_DATE = date(2020, 1, 1)
GEMINI_MODELOS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash"]


def sc_para_data(shortcode):
    try:
        mid = 0
        for ch in shortcode:
            mid = mid * 64 + ALPHABET.index(ch)
        return datetime.fromtimestamp(((mid >> 23) + 1314220021721) / 1000.0, timezone.utc)
    except Exception:
        return None


def cookies_de(sess):
    pares = {}
    if "=" in sess and ";" in sess:
        for parte in sess.split(";"):
            if "=" in parte:
                k, v = parte.strip().split("=", 1)
                pares[k] = v
    else:
        pares["sessionid"] = sess
    if "sessionid" not in pares:
        raise SystemExit("IG_SESSION sem sessionid. Cole o cookie da conta do Instagram no segredo IG_SESSION.")
    return [{"name": k, "value": v, "domain": ".instagram.com", "path": "/"} for k, v in pares.items()]


def varrer(o, username, midias, perfil):
    if isinstance(o, dict):
        if o.get("code") and any(k in o for k in ("play_count", "like_count", "comment_count", "ig_play_count")):
            midias.setdefault(o["code"], {}).update({k: v for k, v in o.items() if v is not None})
        if str(o.get("username", "")).lower() == username and ("follower_count" in o or "edge_followed_by" in o):
            perfil.update({k: v for k, v in o.items() if v is not None})
        for v in o.values():
            varrer(v, username, midias, perfil)
    elif isinstance(o, list):
        for v in o:
            varrer(v, username, midias, perfil)


async def coletar_perfil(context, username):
    midias, perfil = {}, {}
    page = await context.new_page()
    tarefas = set()

    async def ler(resp):
        u = resp.url
        if "/graphql" not in u and "/api/v1/" not in u:
            return
        try:
            txt = await resp.text()
        except Exception:
            return
        for parte in txt.split("\n"):
            try:
                varrer(json.loads(parte), username, midias, perfil)
            except Exception:
                pass

    def on_resp(resp):
        t = asyncio.ensure_future(ler(resp))
        tarefas.add(t)
        t.add_done_callback(tarefas.discard)

    page.on("response", on_resp)
    try:
        await page.goto(f"https://www.instagram.com/{username}/", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3500)
        await page.goto(f"https://www.instagram.com/{username}/reels/", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3500)
        for _ in range(4):
            await page.mouse.wheel(0, 5000)
            await page.wait_for_timeout(2500)
    except Exception as e:
        print(f"  ! {username}: navegação falhou ({e})")
    await page.wait_for_timeout(1500)
    if tarefas:
        await asyncio.gather(*list(tarefas), return_exceptions=True)
    await page.close()
    return midias, perfil


def conta(perfil, *chaves):
    for c in chaves:
        v = perfil.get(c)
        if isinstance(v, dict):
            v = v.get("count")
        if isinstance(v, int):
            return v
    return 0


async def baixar(context, url, destino: Path):
    if not url:
        return False
    try:
        r = await context.request.get(url, timeout=20000)
        if r.ok:
            b = await r.body()
            if len(b) > 100:
                destino.parent.mkdir(parents=True, exist_ok=True)
                destino.write_bytes(b)
                return True
    except Exception:
        pass
    return False


PROMPT = (
    "Você analisa vídeos curtos de Instagram do nicho de tarot, astrologia e manifestação, "
    "público dos EUA, em inglês. Responda SOMENTE um objeto JSON com estas chaves: "
    '"idioma" (idioma falado), '
    '"transcricao" (transcrição literal da fala, no idioma original), '
    '"traducao_pt" (tradução da fala para português), '
    '"gancho" (o hook: a frase/estratégia dos primeiros 3 segundos e por que prende), '
    '"angulo" (o ângulo da copy: ex. predestinação, contraintuitivo, 3 sinais, prova, medo, desejo), '
    '"estrutura" (a estrutura do vídeo em etapas: gancho, identificação, explicação, benefício, CTA...), '
    '"cta" (qual é a chamada para ação no fim), '
    '"por_que_funciona" (1-2 frases: por que esse vídeo provavelmente converte ou viraliza). '
    "Seja específico e curto em cada campo."
)


async def analisar(video_bytes, mime="video/mp4"):
    if not GEMINI_KEY or len(video_bytes) > 18 * 1024 * 1024:
        return None
    corpo = {
        "contents": [{"role": "user", "parts": [
            {"inline_data": {"mime_type": mime, "data": base64.b64encode(video_bytes).decode()}},
            {"text": PROMPT},
        ]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.4},
    }
    async with httpx.AsyncClient(timeout=300) as c:
        for modelo in GEMINI_MODELOS:
            for _ in range(2):
                try:
                    r = await c.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent",
                        headers={"x-goog-api-key": GEMINI_KEY}, json=corpo)
                    if r.status_code in (429, 404):
                        break
                    if r.status_code in (500, 502, 503, 504):
                        await asyncio.sleep(4)
                        continue
                    r.raise_for_status()
                    txt = "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])
                    return json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", txt.strip()))
                except Exception:
                    await asyncio.sleep(3)
    return None


def escrever(rel, texto):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(texto, encoding="utf-8")


async def main():
    cache_path = ROOT / "analise.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}

    perfis_meta, criativos, por_perfil = {}, {}, {}
    pendentes_analise = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            locale="en-US", viewport={"width": 1280, "height": 900})
        await context.add_cookies(cookies_de(IG_SESSION))

        for i, user in enumerate(PERFIS, 1):
            print(f"[{i}/{len(PERFIS)}] @{user}")
            midias, perfil = await coletar_perfil(context, user)
            foto = ""
            if isinstance(perfil.get("hd_profile_pic_url_info"), dict):
                foto = perfil["hd_profile_pic_url_info"].get("url", "")
            foto = foto or perfil.get("profile_pic_url_hd") or perfil.get("profile_pic_url") or ""
            perfis_meta[user] = {
                "seguidores": conta(perfil, "follower_count", "edge_followed_by"),
                "nome_exibicao": perfil.get("full_name") or user,
                "bio": perfil.get("biography") or "",
                "foto": f"perfis/{user}/foto.jpg",
            }
            if foto:
                await baixar(context, foto, ROOT / "perfis" / user / "foto.jpg")

            reels = []
            for code, m in midias.items():
                if m.get("media_type") not in (None, 2):
                    continue
                dt = datetime.fromtimestamp(m["taken_at"], timezone.utc) if m.get("taken_at") else sc_para_data(code)
                cap = m.get("caption")
                imgs = (m.get("image_versions2") or {}).get("candidates") or []
                vids = m.get("video_versions") or []
                reels.append({
                    "code": code,
                    "v": int(m.get("play_count") or m.get("ig_play_count") or m.get("view_count") or 0),
                    "l": int(m.get("like_count") or 0),
                    "k": int(m.get("comment_count") or 0),
                    "legenda": (cap.get("text") if isinstance(cap, dict) else cap) or "",
                    "duration_s": float(m.get("video_duration") or 0) or 15.0,
                    "data": (dt or datetime.now(timezone.utc)),
                    "thumb": imgs[0].get("url", "") if imgs else "",
                    "video": vids[0].get("url", "") if vids else "",
                })
            reels.sort(key=lambda r: -r["v"])
            corte = reels[max(0, len(reels) // 5) - 1]["v"] if reels else 0
            por_perfil[user] = reels
            for r in reels:
                await baixar(context, r["thumb"], ROOT / "perfis" / user / "videos" / r["code"] / "capa.jpg")
                if r["code"] not in cache and r["video"]:
                    pendentes_analise.append((user, r))

            await asyncio.sleep(3)

        # Análise (limitada por execução; prioriza os mais vistos; o resto entra nos próximos dias)
        pendentes_analise.sort(key=lambda t: -t[1]["v"])
        for user, r in pendentes_analise[:MAX_ANALYZE]:
            try:
                resp = await context.request.get(r["video"], timeout=60000)
                if not resp.ok:
                    continue
                dados = await analisar(await resp.body())
            except Exception:
                dados = None
            if dados:
                cache[r["code"]] = dados
                print(f"  analisado @{user} {r['code']}")

        await browser.close()

    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")

    # Monta os criativos para a tela
    numero = 0
    for user in PERFIS:
        reels = por_perfil.get(user, [])
        corte = sorted((r["v"] for r in reels), reverse=True)[max(0, len(reels) // 5) - 1] if reels else 0
        for r in reels:
            numero += 1
            a = cache.get(r["code"], {})
            analysis = []
            for rot, chave in [("Gancho (hook)", "gancho"), ("Ângulo", "angulo"),
                               ("Estrutura", "estrutura"), ("CTA", "cta"), ("Por que funciona", "por_que_funciona")]:
                if a.get(chave):
                    analysis.append({"label": rot, "text": str(a[chave])})
            criativos[r["code"]] = {
                "codigo": r["code"], "perfil": user, "number": numero,
                "v": r["v"], "l": r["l"], "k": r["k"],
                "dias": (r["data"].date() - BASE_DATE).days,
                "data_publicacao": r["data"].strftime("%Y-%m-%d %H:%M:%S"),
                "duration_s": r["duration_s"], "legenda": r["legenda"],
                "top15": bool(r["v"] >= corte and r["v"] > 0), "tipo": "reel",
                "capa": f"perfis/{user}/videos/{r['code']}/capa.jpg", "video": "",
                "language": a.get("idioma", ""),
                "transcricao_audio": a.get("transcricao", ""),
                "traducao_audio": a.get("traducao_pt", ""),
                "analysis": analysis,
            }

    nichos = {u: NICHO for u in PERFIS}
    ajustes = {"versao": 1, "atualizado_em": datetime.now(timezone.utc).isoformat(),
               "criativos": criativos, "editados": {}, "perfis": {}, "removidos": [],
               "perfis_ocultos": [], "pendentes": []}

    escrever("dados/swipe-dados-1.js", "window.MESA_PERFIS_NOMES=[];window.MESA_ITENS=[];\n")
    escrever("dados/swipe-dados-2.js", "window.MESA_ITENS=window.MESA_ITENS.concat([]);\n")
    escrever("dados/swipe-dados-3.js", "window.MESA_ITENS=window.MESA_ITENS.concat([]);\n")
    for n in range(1, 10):
        escrever(f"dados/swipe-busca-{n}.js", "window.MESA_BUSCA=[];\n")
    escrever("dados/perfis-meta.js", "window.MESA_PERFIS_META=" + json.dumps(perfis_meta, ensure_ascii=False) + ";\n")
    escrever("dados/perfis-nichos.js", "window.MESA_PERFIS_NICHOS=" + json.dumps(nichos, ensure_ascii=False) + ";\n")
    escrever("ajustes/ajustes.js", "window.MESA_AJUSTES=" + json.dumps(ajustes, ensure_ascii=False) + ";\n")

    print(f"OK: {len(PERFIS)} perfis, {len(criativos)} vídeos, {len(cache)} análises no total.")


if __name__ == "__main__":
    asyncio.run(main())
