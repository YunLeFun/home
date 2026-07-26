<template>
  <g data-template-id="cloud-apartment">
    <rect data-layer="backdrop" width="1600" height="800" fill="#d7e1f0" />

    <g data-layer="shell">
      <path d="M18 30H1582V790H18Z" fill="#f1f4fa" stroke="#8596b2" stroke-width="8" />
      <path d="M18 30H1582V570H18Z" fill="url(#yun-home-wall)" />
      <path d="M18 570H1582V790H18Z" fill="url(#yun-home-floor)" />
      <path d="M18 570H1582V790H18Z" fill="url(#yun-home-floor-lines)" />
      <path d="M620 32V790M1205 32V790" fill="none" stroke="#8e9db5" stroke-width="9" />
      <path d="M20 570H1580" fill="none" stroke="#9aa9bf" stroke-width="4" />
    </g>

    <g data-room-id="living-room">
      <g data-furniture-id="living-window" filter="url(#yun-home-soft-shadow)">
        <rect x="58" y="92" width="205" height="228" rx="7" fill="#dce7f3" stroke="#8da0bc" stroke-width="6" />
        <rect x="71" y="105" width="179" height="202" rx="3" fill="url(#yun-home-window)" />
        <path d="M160 105V307M71 205H250" fill="none" stroke="#f6fbff" stroke-opacity=".82" stroke-width="7" />
        <path d="M83 287c43-45 88-19 153-84v104H71Z" fill="#91a8c4" fill-opacity=".5" />
      </g>

      <g data-furniture-id="living-wall-art">
        <rect x="405" y="125" width="115" height="150" rx="7" fill="#fbfcff" stroke="#a5b1c5" stroke-width="5" />
        <path d="M426 241c25-54 45-62 74-92v102h-74Z" fill="#aabce1" />
        <circle cx="448" cy="171" r="18" fill="#e7c5bc" />
      </g>

      <g data-furniture-id="living-sofa" filter="url(#yun-home-shadow)">
        <rect x="112" y="435" width="294" height="130" rx="30" fill="url(#yun-home-fabric)" stroke="#7589aa" stroke-width="3" />
        <rect x="126" y="414" width="125" height="106" rx="30" fill="#b8c8e1" stroke="#7d90ae" stroke-width="3" />
        <rect x="262" y="414" width="125" height="106" rx="30" fill="#b0c0db" stroke="#7d90ae" stroke-width="3" />
        <rect x="92" y="457" width="52" height="111" rx="23" fill="#91a5c5" stroke="#7184a5" stroke-width="3" />
        <path d="M402 469h20v108h-25" fill="#879cbd" stroke="#7184a5" stroke-width="3" />
        <path d="M127 558v28M384 558v28" stroke="#6f809b" stroke-width="9" />
        <rect x="276" y="434" width="76" height="48" rx="17" fill="#d8ccdf" transform="rotate(4 276 434)" />
      </g>

      <g data-furniture-id="living-table" filter="url(#yun-home-soft-shadow)">
        <ellipse cx="324" cy="574" rx="126" ry="42" fill="url(#yun-home-wood)" stroke="#8d7768" stroke-width="3" />
        <path d="M245 582 225 670M402 582l20 88" stroke="#806c60" stroke-width="12" stroke-linecap="round" />
        <ellipse cx="324" cy="568" rx="103" ry="27" fill="#d9c7b4" />
      </g>

      <g data-furniture-id="living-plant">
        <path d="M535 476c-48-45-35-83-5-55 13-50 49-45 34 3 38-25 55 14 8 48" fill="#8fad9c" stroke="#6f927f" stroke-width="3" />
        <path d="M551 440v84" stroke="#698775" stroke-width="5" />
        <path d="M514 500h75l-10 69h-55Z" fill="#b99d91" stroke="#8f756d" stroke-width="3" />
      </g>

      <text class="scene-room-label" x="54" y="64" fill="#596983">
        客厅
      </text>
    </g>

    <g data-room-id="bedroom">
      <g data-furniture-id="bedroom-window" filter="url(#yun-home-soft-shadow)">
        <rect x="825" y="91" width="245" height="215" rx="7" fill="#dce7f3" stroke="#8da0bc" stroke-width="6" />
        <rect x="839" y="105" width="217" height="187" rx="3" fill="url(#yun-home-window)" />
        <path d="M947 105V292M839 198H1056" fill="none" stroke="#f6fbff" stroke-opacity=".82" stroke-width="7" />
        <circle cx="1004" cy="154" r="26" fill="#fff6d8" fill-opacity=".78" />
      </g>

      <g data-furniture-id="bed" filter="url(#yun-home-shadow)">
        <rect x="699" y="407" width="354" height="276" rx="22" fill="#8f9fbd" stroke="#667994" stroke-width="4" />
        <rect x="711" y="431" width="330" height="230" rx="18" fill="#d8dcea" />
        <path d="M711 520h330v141H711Z" fill="url(#yun-home-fabric-lilac)" />
        <path d="M711 603c76-24 157 36 330-15v73H711Z" fill="#8e89aa" fill-opacity=".7" />
        <rect x="735" y="446" width="128" height="67" rx="25" fill="#f3f1f5" stroke="#bbb8c8" stroke-width="2" />
        <rect x="880" y="446" width="128" height="67" rx="25" fill="#f3f1f5" stroke="#bbb8c8" stroke-width="2" />
        <path d="M697 414V356h359v62" fill="#9caac2" stroke="#6b7c97" stroke-width="5" />
        <path d="M700 683v24M1053 683v24" stroke="#5f7089" stroke-width="10" />
      </g>

      <g data-furniture-id="bedroom-side-table" filter="url(#yun-home-soft-shadow)">
        <rect x="1064" y="494" width="101" height="119" rx="10" fill="url(#yun-home-wood)" stroke="#8b7567" stroke-width="3" />
        <path d="M1077 532h75M1077 571h75" stroke="#9a8272" stroke-width="3" />
        <circle cx="1113" cy="550" r="3" fill="#6f5d55" />
        <circle cx="1113" cy="589" r="3" fill="#6f5d55" />
        <path d="M1092 490v-43h42v43" fill="#d5b8a4" stroke="#947a6f" stroke-width="3" />
        <path d="M1082 449h62l-12-38h-38Z" fill="#e7ddd3" stroke="#a49387" stroke-width="3" />
      </g>

      <g data-furniture-id="bedroom-rug">
        <path d="M662 696h505l20 77H641Z" fill="#c8c5dc" fill-opacity=".75" stroke="#aaa6c4" stroke-width="2" />
        <path d="M700 722h430M680 748h470" stroke="#aaa6c4" stroke-opacity=".55" stroke-width="2" />
      </g>

      <text class="scene-room-label" x="950" y="64" fill="#596983">
        卧室
      </text>
    </g>

    <g data-room-id="utility-room">
      <rect x="1210" y="34" width="368" height="536" fill="url(#yun-home-wall-lilac)" />

      <g data-furniture-id="utility-shelf">
        <path d="M1260 105v220M1530 105v220M1260 145h270M1260 235h270M1260 325h270" fill="none" stroke="#8d91ac" stroke-width="7" />
        <rect x="1283" y="170" width="65" height="47" rx="7" fill="#d6b9ae" />
        <rect x="1366" y="161" width="82" height="56" rx="7" fill="#aebbd3" />
        <path d="M1470 211v-40h36v40" fill="#b1c3b1" />
        <path d="M1474 174c-18-31 4-47 15-18 14-28 33-7 14 17" fill="#7fa18a" />
      </g>

      <g data-furniture-id="utility-cabinet" filter="url(#yun-home-shadow)">
        <path d="M1234 390h329v195h-329Z" fill="#b9c1d2" stroke="#7d89a3" stroke-width="4" />
        <path d="M1230 389h337v41h-337Z" fill="#dde1eb" stroke="#7d89a3" stroke-width="4" />
        <path d="M1234 487h329M1398 430v155" fill="none" stroke="#8b95ab" stroke-width="3" />
        <circle cx="1378" cy="465" r="4" fill="#6d778d" />
        <circle cx="1418" cy="465" r="4" fill="#6d778d" />
        <rect x="1280" y="430" width="78" height="54" rx="12" fill="#e9edf5" stroke="#939db1" stroke-width="3" />
        <path d="M1294 430c9-19 40-19 50 0" fill="none" stroke="#8d9bad" stroke-width="4" />
        <rect x="1448" y="446" width="72" height="30" rx="8" fill="#d0aec0" />
      </g>

      <g data-furniture-id="utility-baskets">
        <rect x="1270" y="626" width="105" height="91" rx="14" fill="#b69f8f" stroke="#8a7568" stroke-width="3" />
        <path d="M1285 650h75M1285 675h75M1285 700h75" stroke="#d3c0b2" stroke-width="5" />
        <rect x="1419" y="624" width="112" height="98" rx="20" fill="#a9b9d2" stroke="#7789a8" stroke-width="3" />
        <circle cx="1475" cy="673" r="28" fill="#dfe7f2" stroke="#8191aa" stroke-width="4" />
        <circle cx="1475" cy="673" r="19" fill="#b9d2e6" />
      </g>

      <text class="scene-room-label" x="1236" y="64" fill="#61657f">
        家政区
      </text>
    </g>
  </g>
</template>
