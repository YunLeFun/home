<template>
  <g data-template-id="studio">
    <rect data-layer="backdrop" width="1600" height="800" fill="#d7e1f0" />
    <g data-layer="shell">
      <path d="M18 30H1582V790H18Z" fill="#f1f4fa" stroke="#8596b2" stroke-width="8" />
      <path d="M18 30H1582V570H18Z" fill="url(#yun-home-wall)" />
      <path d="M18 570H1582V790H18Z" fill="url(#yun-home-floor)" />
      <path d="M18 570H1582V790H18Z" fill="url(#yun-home-floor-lines)" />
      <path d="M20 570H1580" fill="none" stroke="#9aa9bf" stroke-width="4" />
    </g>

    <g data-room-id="studio-room">
      <g data-furniture-id="studio-window" filter="url(#yun-home-soft-shadow)">
        <rect x="110" y="90" width="360" height="240" rx="8" fill="#dce7f3" stroke="#8da0bc" stroke-width="7" />
        <rect x="126" y="106" width="328" height="208" rx="3" fill="url(#yun-home-window)" />
        <path d="M290 106V314M126 210H454" fill="none" stroke="#f6fbff" stroke-opacity=".84" stroke-width="8" />
        <path d="M138 286c78-77 148-11 304-113v141H126Z" fill="#8ea8c6" fill-opacity=".45" />
      </g>

      <g data-furniture-id="studio-sofa" filter="url(#yun-home-shadow)">
        <rect x="178" y="430" width="456" height="171" rx="35" fill="url(#yun-home-fabric)" stroke="#7589aa" stroke-width="4" />
        <rect x="197" y="405" width="193" height="133" rx="34" fill="#b8c8e1" stroke="#7d90ae" stroke-width="3" />
        <rect x="405" y="405" width="191" height="133" rx="34" fill="#acbdd8" stroke="#7d90ae" stroke-width="3" />
        <rect x="150" y="449" width="62" height="153" rx="27" fill="#91a5c5" stroke="#7184a5" stroke-width="3" />
        <rect x="596" y="449" width="62" height="153" rx="27" fill="#91a5c5" stroke="#7184a5" stroke-width="3" />
        <path d="M203 593v38M608 593v38" stroke="#6f809b" stroke-width="12" />
        <rect x="435" y="430" width="102" height="63" rx="20" fill="#d8ccdf" transform="rotate(3 435 430)" />
      </g>

      <g data-furniture-id="studio-bed" filter="url(#yun-home-shadow)">
        <rect x="690" y="420" width="329" height="286" rx="22" fill="#8f9fbd" stroke="#667994" stroke-width="4" />
        <rect x="703" y="442" width="303" height="241" rx="18" fill="#e0e2ec" />
        <path d="M703 526h303v157H703Z" fill="url(#yun-home-fabric-lilac)" />
        <rect x="727" y="455" width="116" height="62" rx="23" fill="#f6f4f6" stroke="#bbb8c8" stroke-width="2" />
        <rect x="863" y="455" width="116" height="62" rx="23" fill="#f6f4f6" stroke="#bbb8c8" stroke-width="2" />
        <path d="M690 424V369h329v58" fill="#9caac2" stroke="#6b7c97" stroke-width="5" />
      </g>

      <g data-furniture-id="studio-desk" filter="url(#yun-home-shadow)">
        <path d="M1034 440h320v76h-320Z" fill="url(#yun-home-wood)" stroke="#8b7567" stroke-width="4" />
        <path d="M1058 516 1038 694M1330 516l19 178" stroke="#806c60" stroke-width="13" stroke-linecap="round" />
        <rect x="1090" y="332" width="170" height="105" rx="10" fill="#6f7e98" stroke="#4f5f78" stroke-width="4" />
        <rect x="1102" y="344" width="146" height="81" rx="5" fill="url(#yun-home-window)" />
        <path d="M1175 438v28M1137 466h76" stroke="#707d93" stroke-width="8" stroke-linecap="round" />
        <rect x="1270" y="401" width="50" height="35" rx="7" fill="#d8c0b7" />
        <path d="M1280 403c4-22 26-27 30 0" fill="none" stroke="#839f86" stroke-width="8" />
      </g>

      <g data-furniture-id="studio-rug">
        <path d="M86 691h1430l39 80H42Z" fill="#c8c5dc" fill-opacity=".55" stroke="#aaa6c4" stroke-width="2" />
        <path d="M138 722h1325M95 750h1410" stroke="#aaa6c4" stroke-opacity=".45" stroke-width="2" />
      </g>

      <text class="scene-room-label" x="54" y="64" fill="#596983">
        云朵单间
      </text>
    </g>
  </g>
</template>
