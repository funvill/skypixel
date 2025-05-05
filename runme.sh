#!/usr/bin/env bash

# ─────────────────────────────────────────────────
# Resolve the script’s directory (handles symlinks too)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build a timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M")

# Build the output directory
OUTPUT_DIR="${SCRIPT_DIR}/images"
# ─────────────────────────────────────────────────



## CURL webcams
## 
## This is a list of webcams that I need to use CURL to download the images
## ------------------------------------------------------------------------

# Regina, Saskatchewan Bypass Tower Cam
curl https://hotline.gov.sk.ca/map/Cctv/a5j2lv0jyvu--1 --output "${OUTPUT_DIR}/regina-bypass-tower/${TIMESTAMP}.jpg"

# 12 Avenue / 5th Street SW - Calgary, Alberta
# https://511.alberta.ca/cctv
curl https://511.alberta.ca/map/Cctv/475 --output "${OUTPUT_DIR}/calgary-12ave-5st/${TIMESTAMP}.jpg"

# manitoba-minnedosa-hwy10
# https://www.manitoba511.ca/cctv?start=0&length=10&order%5Bi%5D=1&order%5Bdir%5D=asc
curl https://www.manitoba511.ca/map/Cctv/15 --output "${OUTPUT_DIR}/manitoba-minnedosa-hwy10/${TIMESTAMP}.jpg"

# new-brunswick-waweig-rte1
# https://nbcams.ca/
curl https://www3.gnb.ca/0113/cameras/cam-images/RNBWG.jpg --output "${OUTPUT_DIR}/new-brunswick-waweig-rte1/${TIMESTAMP}.jpg"

# new-brunswick-saint-john-rte1
# https://nbcams.ca/
curl https://www3.gnb.ca/0113/cameras/cam-images/RNBSJ.jpg --output "${OUTPUT_DIR}/new-brunswick-saint-john-rte1/${TIMESTAMP}.jpg"

# new-brunswick-saint-john-millidgeville
# https://nbcams.ca/
curl https://nbcams.ca/hosted/tf3.pl --output "${OUTPUT_DIR}/new-brunswick-saint-john-millidgeville/${TIMESTAMP}.jpg"

# newfoundland-paddys-pond
# https://www.gov.nl.ca/ti/roads/cameras/
curl https://www.gov.nl.ca/ti/highway-cams/cameras/sites/paddyspond/current.jpg --output "${OUTPUT_DIR}/newfoundland-paddys-pond/${TIMESTAMP}.jpg"

# princeedwardisland-st-peters-hwy2
# https://511.gov.pe.ca/map
curl https://511.gov.pe.ca/map/Cctv/5 --output "${OUTPUT_DIR}/princeedwardisland-st-peters-hwy2/${TIMESTAMP}.jpg"

# nwt-arviat-airport-cyek N61 05 38 W94 04 18 - northwest territories
# https://metcam.navcanada.ca/hb/player.jsp?id=200&cam=512&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYEK/CYEK_E-full-e.jpeg --output "${OUTPUT_DIR}/nwt-arviat-airport-cyek/${TIMESTAMP}.jpg"

# Braeburn Braeburn Airport (CEK2) N61 29 04 W135 46 35 - yukon
# https://metcam.navcanada.ca/hb/player.jsp?id=200&cam=512&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CEK2/CEK2_NE-full-e.jpeg --output "${OUTPUT_DIR}/yukon-braeburn-airport-cek2/${TIMESTAMP}.jpg"

# Vancouver Intl Airport (CYVR) N49 11 41 W123 11 02 - british columbia
# https://metcam.navcanada.ca/hb/player.jsp?id=202&cam=539&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYVR/CYVR_SW-full-e.jpeg --output "${OUTPUT_DIR}/british-columbia-vancouver-airport-cyvr/${TIMESTAMP}.jpg"

# Springbank Airport (CYBW) N51 06 11 W114 22 27 - calgary
# https://metcam.navcanada.ca/hb/player.jsp?id=170&cam=392&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYBW/CYBW_N-full-e.jpeg --output "${OUTPUT_DIR}/alberta-springbank-airport-cybw/${TIMESTAMP}.jpg"

# North Battleford (CYQW) N52 46 09 W108 14 - saskatchewan
# https://metcam.navcanada.ca/hb/player.jsp?id=53&cam=121&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYQW/CYQW_N-full-e.jpeg --output "${OUTPUT_DIR}/saskatchewan-north-battleford-cyqw/${TIMESTAMP}.jpg"

# Dauphin (CYDN) N51 06 03 W100 03 09 - manitoba
# https://metcam.navcanada.ca/hb/player.jsp?id=73&cam=169&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYDN/CYDN_N-full-e.jpeg --output "${OUTPUT_DIR}/manitoba-dauphin-cydn/${TIMESTAMP}.jpg"

# Armstrong Airport (CYYW) N50 17 25 W88 54 35 - ontario
# https://metcam.navcanada.ca/hb/player.jsp?id=189&cam=469&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYYW/CYYW_N-full-e.jpeg --output "${OUTPUT_DIR}/ontario-armstrong-airport-cyyw/${TIMESTAMP}.jpg"

# St. Hubert Airport (CYHU) N45 31 03 W73 25 01 - Quebec
# https://metcam.navcanada.ca/hb/player.jsp?id=37&cam=85&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYHU/CYHU_NE-full-e.jpeg --output "${OUTPUT_DIR}/quebec-st-hubert-airport-cyhu/${TIMESTAMP}.jpg"

# Cartwright Airport (CYCA) N53 40 57 W57 02 31 - newfoundland
# https://metcam.navcanada.ca/hb/player.jsp?id=241&cam=712&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYCA/CYCA_N-full-e.jpeg --output "${OUTPUT_DIR}/newfoundland-cartwright-airport-cyca/${TIMESTAMP}.jpg"

# Bathurst Airport (CZBF) N47 37 46 W65 44 25 - new-brunswick
# https://metcam.navcanada.ca/hb/player.jsp?id=238&cam=702&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CZBF/CZBF_N-full-e.jpeg --output "${OUTPUT_DIR}/new-brunswick-bathurst-airport-czbf/${TIMESTAMP}.jpg"

# Port Hawkesbury (CYPD) N45 39 24 W61 22 - nova scotia 
# https://metcam.navcanada.ca/hb/player.jsp?id=54&cam=534&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYPD/CYPD_N-full-e.jpeg --output "${OUTPUT_DIR}/nova-scotia-port-hawkesbury-cypd/${TIMESTAMP}.jpg"

# Arviat Airport (CYEK) N61 05 38 W94 04 18 - nunavut
# https://metcam.navcanada.ca/hb/player.jsp?id=200&cam=509&lang=e
curl https://metcam.navcanada.ca/dawc_images/wxcam/CYEK/CYEK_N-full-e.jpeg --output "${OUTPUT_DIR}/nunavut-arviat-airport-cyek/${TIMESTAMP}.jpg"

## YouTube videos
##
## This list of YouTube videos is from searching for "live" "webcam" and "Vancouver"
## and "Canada" in YouTube. Then searching though the list to see ones that showed 
## parts of the sky
## ------------------------------------------------------------------------

# Deep Cove, Vancouver Canada Webcam
# https://www.youtube.com/watch?v=T0oUufecXeE
"${SCRIPT_DIR}/capture_frame.sh" T0oUufecXeE

# English Bay Vancouver, Kits Beach, Vanier Park, Sunset Beach, Westend, Ships
# https://www.youtube.com/watch?v=Fq-P0bdelRs
"${SCRIPT_DIR}/capture_frame.sh" Fq-P0bdelRs

# White Rock, Canada
# https://www.youtube.com/watch?v=4MK3E9EWDSY
"${SCRIPT_DIR}/capture_frame.sh" 4MK3E9EWDSY

# Whistler Olympic Plaza
# https://www.youtube.com/watch?v=IEhDUXECe_k
"${SCRIPT_DIR}/capture_frame.sh" IEhDUXECe_k

# White Rock, B.C. - White Rock Museum looking West
# https://www.youtube.com/watch?v=LENLyDDEtUM
"${SCRIPT_DIR}/capture_frame.sh" LENLyDDEtUM

# Mt Seymour Ski Area, Vancouver, BC
# https://www.youtube.com/watch?v=vLawo-FrBKk
"${SCRIPT_DIR}/capture_frame.sh" vLawo-FrBKk

# Crystal Cove Beach Resort, Tofino, B.C.
# https://www.youtube.com/watch?v=AovvFApVnKc
"${SCRIPT_DIR}/capture_frame.sh" AovvFApVnKc

# Departure Bay
# https://www.youtube.com/watch?v=2G7bdqbL1EU
"${SCRIPT_DIR}/capture_frame.sh" 2G7bdqbL1EU

# White Rock, B.C. - Memorial Park Camera
# https://www.youtube.com/watch?v=IRIAXc0iT9A
"${SCRIPT_DIR}/capture_frame.sh" IRIAXc0iT9A

# Surrey, B.C. border
# https://www.youtube.com/watch?v=Hcl9l2Z8mTI
"${SCRIPT_DIR}/capture_frame.sh" Hcl9l2Z8mTI

# Whistler Golf Club - 1st hole
# https://www.youtube.com/watch?v=JVQaZtahjwg
"${SCRIPT_DIR}/capture_frame.sh" JVQaZtahjwg

# Main Street Canmore
# https://www.youtube.com/watch?v=kC6_JqEt3GA
"${SCRIPT_DIR}/capture_frame.sh" kC6_JqEt3GA

# Pacific Sands Beach Resort, Tofino, BC
# https://www.youtube.com/watch?v=g2HGBY2v-wo
"${SCRIPT_DIR}/capture_frame.sh" g2HGBY2v-wo

# Peace Bridge - Buffalo NY
# https://www.youtube.com/watch?v=DnUFAShZKus
"${SCRIPT_DIR}/capture_frame.sh" DnUFAShZKus

# Howe Sound
# Note: Seems to be broken as of 2025-May-02
# https://www.youtube.com/watch?v=SDGEHMh3WOA
"${SCRIPT_DIR}/capture_frame.sh" SDGEHMh3WOA

# Lions Chair Cam
# https://www.youtube.com/watch?v=lLELhY85VxI
"${SCRIPT_DIR}/capture_frame.sh" lLELhY85VxI

# Eagle Chair Cam
# https://www.youtube.com/watch?v=GTQQdQ8VVKI
"${SCRIPT_DIR}/capture_frame.sh" GTQQdQ8VVKI

# Lockeport Crescent Beach Centre, Nova Scotia
# https://www.youtube.com/watch?v=Pwt0tZlt9eE
"${SCRIPT_DIR}/capture_frame.sh" Pwt0tZlt9eE

# Tidal Bore LIVE at Fundy Discovery Site in Truro, Nova Scotia
# https://www.youtube.com/watch?v=dQzt2xtk7kY
"${SCRIPT_DIR}/capture_frame.sh" dQzt2xtk7kY

# Parry Sound, Ontario Canada
# https://www.youtube.com/watch?v=qqSa53vxgBY
"${SCRIPT_DIR}/capture_frame.sh" qqSa53vxgBY

# Port de Québec
# https://www.youtube.com/watch?v=I-7mv4-BJ7M
"${SCRIPT_DIR}/capture_frame.sh" I-7mv4-BJ7M

# Calgary Live Camera
# https://www.youtube.com/watch?v=MwcqP3ta6RI
"${SCRIPT_DIR}/capture_frame.sh" MwcqP3ta6RI

## Not Canada
## ---------------------------------------------------------

# Charlotte-Genesee Overlooking Lake Ontario in Rochester, N.Y
# https://www.youtube.com/watch?v=KTKN8RbYefQ
"${SCRIPT_DIR}/capture_frame.sh" KTKN8RbYefQ

# Crystal Bay Beach Resort | Lamai | Koh Samui | Thailand
# https://www.youtube.com/watch?v=Fw9hgttWzIg
"${SCRIPT_DIR}/capture_frame.sh" Fw9hgttWzIg

# Venice - St. Mark's Basin
# https://www.youtube.com/watch?v=dFBRpHHwQeg
"${SCRIPT_DIR}/capture_frame.sh" dFBRpHHwQeg

# Greenhill Beach (Weymouth)
# https://www.youtube.com/watch?v=s2rzmSNpyns
"${SCRIPT_DIR}/capture_frame.sh" s2rzmSNpyns

# Blenheim Dawlish
# https://www.youtube.com/watch?v=Y28zZGsYkjg
"${SCRIPT_DIR}/capture_frame.sh" Y28zZGsYkjg

# Cape Town - South Africa
# https://www.youtube.com/watch?v=-zgjmZ_nZLI
"${SCRIPT_DIR}/capture_frame.sh" -zgjmZ_nZLI


# ------------------------------------------------------------------------

# Extract the sky parts of the image and delete the original file to save space
cd "${SCRIPT_DIR}/imageProcessor/"
npm run extract
