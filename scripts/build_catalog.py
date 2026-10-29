#!/usr/bin/env python3
"""Build and grow a static, source-attributed Russian football pitch catalogue.

Reads real OSM features through Overpass; NEVER manufactures pitch locations.
For each city: merge by OSM type/id, track original OSM link and extraction UTC.
Usage: python scripts/build_catalog.py --limit 16
"""
import argparse
import datetime as dt
import json
import math
import os
import pathlib
import random
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "fields-catalog.js"
STATE = ROOT / "data" / "catalog-progress.json"
AGENT = "POLE-football-catalog/0.1 (+https://github.com/krasikovaanna1303-afk/myfootballapp)"
SERVERS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
# Cities and approximate coverage radii, in kilometres. Real pitch coordinates always
# originate from Overpass responses, not the coordinates of these city centres.
CITIES = [
    ("Санкт-Петербург",59.9343,30.3351,22),("Москва",55.7558,37.6173,23),
    ("Казань",55.7961,49.1064,15),("Нижний Новгород",56.2965,43.9361,15),
    ("Екатеринбург",56.8389,60.6057,19),("Новосибирск",55.0302,82.9204,20),
    ("Самара",53.1959,50.1002,16),("Краснодар",45.0355,38.9753,17),
    ("Ростов-на-Дону",47.2357,39.7015,16),("Уфа",54.7388,55.9721,17),
    ("Челябинск",55.1644,61.4368,16),("Пермь",58.0105,56.2502,16),
    ("Омск",54.9885,73.3242,17),("Воронеж",51.6720,39.1843,16),
    ("Волгоград",48.7080,44.5133,17),("Красноярск",56.0106,92.8526,18),
    ("Саратов",51.5336,46.0343,14),("Тюмень",57.1530,65.5343,16),
    ("Тольятти",53.5078,49.4204,15),("Ижевск",56.8528,53.2115,13),
    ("Барнаул",53.3474,83.7785,14),("Ульяновск",54.3142,48.4031,14),
    ("Иркутск",52.2869,104.3050,14),("Хабаровск",48.4802,135.0719,14),
    ("Ярославль",57.6261,39.8845,14),("Владивосток",43.1155,131.8855,15),
    ("Махачкала",42.9849,47.5047,13),("Томск",56.4846,84.9481,14),
    ("Оренбург",51.7682,55.0969,15),("Кемерово",55.3547,86.0873,13),
    ("Новокузнецк",53.7576,87.1361,15),("Рязань",54.6296,39.7416,13),
    ("Астрахань",46.3497,48.0408,13),("Пенза",53.1951,45.0183,14),
    ("Липецк",52.6088,39.5992,13),("Киров",58.6035,49.6680,14),
    ("Чебоксары",56.1439,47.2489,12),("Калининград",54.7104,20.4522,14),
    ("Тула",54.1931,37.6173,13),("Курск",51.7304,36.1926,13),
    ("Севастополь",44.6167,33.5254,14),("Белгород",50.5957,36.5872,12),
    ("Тверь",56.8587,35.9176,13),("Псков",57.8194,28.3318,12),
    ("Великий Новгород",58.5215,31.2755,12),("Мурманск",68.9707,33.0749,14),
    ("Архангельск",64.5393,40.5187,14),("Петрозаводск",61.7850,34.3469,13),
    ("Сыктывкар",61.6688,50.8357,12),("Вологда",59.2205,39.8915,12),
    ("Смоленск",54.7818,32.0401,13),("Брянск",53.2434,34.3633,13),
    ("Кострома",57.7677,40.9269,12),("Владимир",56.1291,40.4071,12),
    ("Калуга",54.5138,36.2612,12),("Орёл",52.9704,36.0635,12),
    ("Саранск",54.1838,45.1749,12),("Йошкар-Ола",56.6344,47.8998,12),
    ("Набережные Челны",55.7436,52.3958,15),("Магнитогорск",53.4072,58.9791,14),
    ("Нальчик",43.4840,43.6071,11),("Грозный",43.3180,45.6982,13),
    ("Владикавказ",43.0367,44.6678,12),("Ставрополь",45.0445,41.9690,13),
    ("Сочи",43.6028,39.7342,16),("Новороссийск",44.7235,37.7686,12),
    ("Анапа",44.8950,37.3163,12),("Таганрог",47.2221,38.8973,12),
    ("Сургут",61.2540,73.3962,14),("Нижневартовск",60.9397,76.5696,13),
    ("Якутск",62.0355,129.6755,13),("Чита",52.0340,113.4994,13),
    ("Благовещенск",50.2907,127.5272,12),("Комсомольск-на-Амуре",50.5500,137.0000,12),
    ("Южно-Сахалинск",46.9591,142.7380,12),("Улан-Удэ",51.8272,107.5847,13),
    ("Горно-Алтайск",51.9581,85.9603,11),("Абакан",53.7212,91.4424,12),
    ("Кызыл",51.7191,94.4378,11),("Курган",55.4444,65.3161,12),
    ("Стерлитамак",53.6304,55.9308,12),("Салават",53.3617,55.9246,12),
    ("Дзержинск",56.2384,43.4616,11),("Арзамас",55.3867,43.8157,10),
    ("Сортавала",61.7023,30.6919,10),("Выборг",60.7102,28.7494,11),
    ("Гатчина",59.5764,30.1283,12),("Колпино",59.7507,30.5886,10),
    ("Пушкин",59.7222,30.4165,11),("Всеволожск",60.0218,30.6505,11),
    ("Сестрорецк",60.0981,29.9636,11),("Петергоф",59.8833,29.9000,11),
    ("Кингисепп",59.3734,28.6114,11),("Тихвин",59.6442,33.5070,11),
    ("Луга",58.7370,29.8455,11),("Волхов",59.9241,32.3299,11),
]
EXCLUDED_SPORTS = {"basketball","tennis","volleyball","badminton","handball",
                    "hockey","ice_hockey","skateboard","table_tennis",
                    "beachvolleyball","golf","padel","bowls","baseball"}

def bounds(lat, lon, radius_km):
    delta_lat = radius_km/111.2
    delta_lon = radius_km/(111.2*max(0.25, math.cos(math.radians(lat))))
    return ",".join(f"{v:.5f}" for v in (lat-delta_lat,lon-delta_lon,lat+delta_lat,lon+delta_lon))

def query(bbox):
    return ('[out:json][timeout:45];('+
            f'nwr["leisure"="pitch"]({bbox});'+
            f'nwr["leisure"="practice_pitch"]["sport"~"soccer|futsal|football",i]({bbox});'+
            f'nwr["leisure"="sports_centre"]["sport"~"soccer|futsal|football",i]({bbox});'+
            f'nwr["leisure"="stadium"]["sport"~"soccer|futsal|football",i]({bbox});'+
            f'nwr["amenity"="school"]["sport"~"soccer|futsal|football",i]({bbox});'+
            ');out center 12000;')

def fetch(query_text):
    payload=urllib.parse.urlencode({"data":query_text}).encode()
    last_error=None
    for url in SERVERS:
        try:
            req=urllib.request.Request(url,payload,{"User-Agent":AGENT,"Content-Type":"application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req,timeout=90) as res:
                if res.status!=200: raise ValueError(f"HTTP {res.status}")
                data=json.load(res)
                if not isinstance(data.get("elements"),list):raise ValueError("Invalid OSM elements")
                return data["elements"],url
        except Exception as exc:
            last_error=exc
            print(f"  {url}: {str(exc)[:120]}",flush=True)
            time.sleep(1)
    raise RuntimeError(str(last_error))

def normalize(element, city, now):
    t=element.get("tags") or {}
    coords=element.get("center") or element
    try: lat,lon=float(coords["lat"]),float(coords["lon"])
    except (TypeError,ValueError,KeyError):return
    if not(-90<=lat<=90 and -180<=lon<=180):return
    sport=t.get("sport","").lower();name=t.get("name","")
    sportset=set(re.split(r"[;, ]+",sport))
    soccer=bool(re.search(r"soccer|futsal|mini_soccer|football",sport,re.I) or re.search(r"футбол|soccer|football",name,re.I))
    if not soccer and (sportset & EXCLUDED_SPORTS):return
    if not soccer and re.search(r"теннис|баскетбол|волейбол|хоккей|tennis|basketball|volleyball|hockey",name,re.I):return
    is_school=t.get("amenity")=="school" or t.get("operator:type")=="school" or bool(re.search(r"школа|лицей|гимназия",name,re.I))
    restriction=t.get("access","")
    if restriction in ("no","private","customers","permit"): access="private"
    elif t.get("fee")=="yes":access="paid"
    elif t.get("fee")=="no":
        access="free" if restriction in ("yes","public","permissive") and not is_school else "free_tag"
    else:access="unknown"
    if is_school and access in ("free","free_tag"):access="unknown"
    typ=element.get("type","")
    objid=element.get("id")
    if typ not in ("node","way","relation") or not isinstance(objid,int):return
    return {
      "id":f"osm-{typ}-{objid}",
      "name":name or ("Школьная спортплощадка — проверить футбол" if is_school else "Футбольная площадка" if soccer else "Дворовая/универсальная спортплощадка"),
      "city":t.get("addr:city") or city,
      "address":", ".join(filter(None,[t.get("addr:street"),t.get("addr:housenumber")])),
      "lat":round(lat,7),"lon":round(lon,7),
      "surface":t.get("surface") or "Не указано",
      "lit":True if t.get("lit")=="yes" else False if t.get("lit")=="no" else None,
      "paid":True if t.get("fee")=="yes" else False if t.get("fee")=="no" else None,
      "access":access,"potential":not soccer or t.get("amenity")=="school",
      "school":bool(is_school),"schoolAccessVerified":False,
      "source":f"https://www.openstreetmap.org/{typ}/{objid}",
      "dateChecked":now,
      "description":"OpenStreetMap: сведения о доступности и возможности игры требуют проверки.",
      "reviews":[]
    }

def read_catalog():
    if not CATALOG.exists():return []
    text=CATALOG.read_text(encoding="utf8")
    prefix="window.POLE_PERMANENT_FIELDS="
    if not text.startswith(prefix):return []
    try:
        body=text[len(prefix):].split(";\nwindow.POLE_CATALOG_METADATA=",1)[0]
        return json.loads(body)
    except Exception as exc:
        print(f"Existing catalogue parse error: {exc}",file=sys.stderr)
        return []

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--limit",type=int,default=20)
    args=parser.parse_args()
    STATE.parent.mkdir(parents=True,exist_ok=True)
    state=json.loads(STATE.read_text(encoding="utf8")) if STATE.exists() else {"next_index":0,"checked":{}}
    existing={x["id"]:x for x in read_catalog()}
    now=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    start=state.get("next_index",0)%len(CITIES)
    successes=0
    for pos in range(min(max(args.limit,1),len(CITIES))):
        i=(start+pos)%len(CITIES);city,lat,lon,radius=CITIES[i]
        print(f"[{pos+1}/{args.limit}] {city}: scanning OSM...",flush=True)
        try:
            items,server=fetch(query(bounds(lat,lon,radius)))
            new=[rec for elem in items if (rec:=normalize(elem,city,now))]
            for rec in new: existing[rec["id"]]=rec
            state["checked"][city]={"time":now,"features":len(new),"server":server}
            successes+=1
            print(f"  {len(new)} candidate pitches; catalogue now {len(existing)} unique",flush=True)
        except Exception as exc:
            print(f"  FAILED: {exc}",flush=True)
            state["checked"][city]={"time":now,"error":str(exc)[:150]}
        # Move cursor even on failure to avoid getting stuck on a broken region.
        state["next_index"]=(i+1)%len(CITIES)
        time.sleep(1.5)
    if successes:
        records=sorted(existing.values(),key=lambda f:(f.get("city",""),f["id"]))
        blob=json.dumps(records,ensure_ascii=False,separators=(",",":"))
        metadata={"generated_at":now,"count":len(records),"checked_cities":sum("features" in x for x in state["checked"].values()),"total_target_cities":len(CITIES),"source":"© OpenStreetMap contributors, ODbL"}
        CATALOG.write_text("window.POLE_PERMANENT_FIELDS="+blob+";\nwindow.POLE_CATALOG_METADATA="+json.dumps(metadata,ensure_ascii=False)+";\n",encoding="utf8")
    STATE.write_text(json.dumps(state,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    print(f"Complete: successful cities={successes}; unique source-tagged pitches={len(existing)}",flush=True)
    # Fail only if there is no usable catalogue whatsoever.
    if not existing:sys.exit(1)

if __name__=="__main__":main()
