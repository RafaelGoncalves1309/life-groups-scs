

// script.js - versão final limpa e profissional

const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgdH0cmFEiB6QLb2SyvgXI5DxIp8T-Q80sBt-r8GFbixEOb04DbK78zVgYsao-uX9etEm3_IVc-AxC/pub?output=csv";

let map;
let markersLayer; // 🔥 camada de marcadores

const igrejaLat = -23.6232483430473;
const igrejaLng = -46.5494611915352;


// ================= BUSCAR DADOS =================
async function buscarGrupos() {
  const res = await fetch(sheetURL + "&t=" + new Date().getTime());
  const csvText = await res.text();

  const grupos = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true
  }).data;

  const gruposCorrigidos = grupos.map(g => {
    const obj = {};
    for (let key in g) obj[key.trim()] = g[key].trim();
    return obj;
  });

  return gruposCorrigidos.map(g => ({
    ...g,
    latitude: parseFloat(g.Latitude),
    longitude: parseFloat(g.Longitude)
  }));
}


// ================= INICIAR MAPA =================
async function iniciarMapa() {
  if (map) {
    map.remove();
  }

  map = L.map('mapa').setView([igrejaLat, igrejaLng], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  // 🔥 cria camada de marcadores
  markersLayer = L.layerGroup().addTo(map);

  // 📍 marcador da igreja
  L.marker([igrejaLat, igrejaLng])
    .addTo(markersLayer)
    .bindPopup("Campus São Caetano")
    .openPopup();

  // 🔥 BUSCAR LIFES
  const grupos = await buscarGrupos();

  // 🔥 LISTA (base igreja)
  mostrarGrupos(grupos, igrejaLat, igrejaLng);

  // 🔥 MAPA (mostra os lifes também)
  mostrarMapa(grupos, igrejaLat, igrejaLng);

  // 🔥 RECOLOCA a igreja (porque mostrarMapa limpa tudo)
  L.marker([igrejaLat, igrejaLng])
    .addTo(markersLayer)
    .bindPopup("Campus São Caetano");
}


// ================= DISTÂNCIA =================
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// ================= LISTA =================
function mostrarGrupos(grupos, userLat, userLng) {
  const div = document.getElementById("lista");
  div.innerHTML = "";

  grupos.sort((a, b) =>
    calcularDistancia(userLat, userLng, a.latitude, a.longitude) -
    calcularDistancia(userLat, userLng, b.latitude, b.longitude)
  );

  let html = "";

  grupos.forEach(g => {
    const dist = calcularDistancia(userLat, userLng, g.latitude, g.longitude).toFixed(2);

    html += `
      <div style="margin-bottom: 15px;">
        <b>${g["Nome do Life"]}</b><br>
        ${g.Endereco}, ${g.Bairro}, ${g.Cidade} (${dist} km)<br>
        ${g.Dia} às ${g.Horario}<br>
        Líder: ${g.Lider} | Contato: ${g.Telefone}<br>
        Público: ${g.Publico}
      </div>
    `;
  });

  div.innerHTML = html;
}


// ================= MAPA =================
function mostrarMapa(grupos, userLat, userLng) {
  map.setView([userLat, userLng], 13);

  // 🔥 LIMPA TODOS OS MARCADORES (inclusive igreja)
  markersLayer.clearLayers();

  // 📍 usuário
  L.marker([userLat, userLng])
    .addTo(markersLayer)
    .bindPopup("Você está aqui")
    .openPopup();

  const lifeIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  grupos.forEach(g => {
    if (!isNaN(g.latitude) && !isNaN(g.longitude)) {
      const dist = calcularDistancia(userLat, userLng, g.latitude, g.longitude).toFixed(2);

      L.marker([g.latitude, g.longitude], { icon: lifeIcon })
        .addTo(markersLayer)
        .bindPopup(`
          <b>${g["Nome do Life"]}</b><br>
          ${g.Endereco}<br>
          ${g.Bairro}, ${g.Cidade}<br>
          ${g.Dia} às ${g.Horario}<br>
          Distância: ${dist} km<br>
          Público: ${g.Publico}
        `);
    }
  });
}


// ================= GEOLOCALIZAÇÃO =================
function buscarLocalizacao() {
  if (!navigator.geolocation) {
    alert("Geolocalização não suportada.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;

    const grupos = await buscarGrupos();

    mostrarGrupos(grupos, userLat, userLng);
    mostrarMapa(grupos, userLat, userLng);
  });
}


// ================= GEOCODE =================
async function geocodeEnderecoOSM(endereco) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.length > 0) {
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon)
    };
  }

  alert("Endereço não encontrado.");
  return null;
}


// ================= BOTÕES =================
document.getElementById("btn-buscar").addEventListener("click", async () => {
  const endereco = document.getElementById("input-endereco").value;

  if (!endereco) {
    alert("Digite um endereço válido!");
    return;
  }

  const pos = await geocodeEnderecoOSM(endereco);
  if (!pos) return;

  const grupos = await buscarGrupos();

  mostrarGrupos(grupos, pos.lat, pos.lng);
  mostrarMapa(grupos, pos.lat, pos.lng);
});


document.getElementById("btn-limpar").addEventListener("click", () => {
  document.getElementById("input-endereco").value = "";
  document.getElementById("lista").innerHTML = "";

  iniciarMapa();
});


// ================= INÍCIO =================
window.onload = () => {
  iniciarMapa();
};


