// script.js - versão adaptada para input de endereço

const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgdH0cmFEiB6QLb2SyvgXI5DxIp8T-Q80sBt-r8GFbixEOb04DbK78zVgYsao-uX9etEm3_IVc-AxC/pub?output=csv";
let map; // mapa global para não recriar várias vezes

// Buscar dados do CSV
async function buscarGrupos() {
  const res = await fetch(sheetURL);
  const csvText = await res.text();
  const grupos = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

  // Corrigir colunas e espaços
  const gruposCorrigidos = grupos.map(g => {
    const obj = {};
    for (let key in g) obj[key.trim()] = g[key].trim();
    return obj;
  });

  // Converter latitude e longitude
  return gruposCorrigidos.map(g => ({
    ...g,
    latitude: parseFloat(g.Latitude),
    longitude: parseFloat(g.Longitude)
  }));
}

// Geocoding OpenStreetMap
async function geocodeEnderecoOSM(endereco) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  alert("Endereço não encontrado.");
  return null;
}

// Haversine para distância
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const a = Math.sin(dLat/2)**2 + Math.cos(lat1Rad)*Math.cos(lat2Rad)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Mostrar lista
function mostrarGrupos(grupos, userLat, userLng) {
  const div = document.getElementById("lista");
  div.innerHTML = "";

  grupos.sort((a, b) => calcularDistancia(userLat, userLng, a.latitude, a.longitude) -
                         calcularDistancia(userLat, userLng, b.latitude, b.longitude));

  let html = "";
  grupos.forEach(g => {
    const dist = calcularDistancia(userLat, userLng, g.latitude, g.longitude).toFixed(2);
    html += `
      <p>
        <b>${g["Nome do Life"]}</b> — ${g.Endereco},${g.Bairro}, ${g.Cidade} (${dist} km)<br>
        ${g.Dia} às ${g.Horario} | Líder: ${g.Lider} | Contato: ${g.Telefone}<br>
        Público: ${g.Publico}
      </p>
    `;
  });
  div.innerHTML = html;
}

// Mostrar mapa
function mostrarMapa(grupos, userLat, userLng) {
  if (!map) {
    map = L.map('mapa').setView([userLat, userLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  } else {
    map.setView([userLat, userLng], 13);
    map.eachLayer(layer => {
      if (layer instanceof L.Marker && !layer._popup._content.includes("Você está aqui")) map.removeLayer(layer);
    });
  }

  // Marcador do usuário
  L.marker([userLat, userLng]).addTo(map).bindPopup("Você está aqui").openPopup();

  // Ícone de casa
  const lifeIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  grupos.forEach(g => {
    if (!isNaN(g.latitude) && !isNaN(g.longitude)) {
      const dist = calcularDistancia(userLat, userLng, g.latitude, g.longitude).toFixed(2);
      L.marker([g.latitude, g.longitude], { icon: lifeIcon }).addTo(map)
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

  setTimeout(() => map.invalidateSize(), 100);
}

// Usar localização do navegador
function buscarLocalizacao() {
  if (!navigator.geolocation) { alert("Geolocalização não suportada."); return; }
  navigator.geolocation.getCurrentPosition(async pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    const grupos = await buscarGrupos();
    mostrarGrupos(grupos, userLat, userLng);
    mostrarMapa(grupos, userLat, userLng);
  }, err => { alert("Não foi possível acessar a localização."); console.error(err); });
}

// Buscar pelo endereço do input
document.getElementById("btn-buscar").addEventListener("click", async () => {
  const endereco = document.getElementById("input-endereco").value;
  if (!endereco) { alert("Digite um endereço!"); return; }
  const pos = await geocodeEnderecoOSM(endereco);
  if (!pos) return;
  const grupos = await buscarGrupos();
  mostrarGrupos(grupos, pos.lat, pos.lng);
  mostrarMapa(grupos, pos.lat, pos.lng);
});

document.getElementById("btn-limpar").addEventListener("click", () => {
  // Limpa o input
  document.getElementById("input-endereco").value = "";

  // Limpa a lista
  document.getElementById("lista").innerHTML = "";

  // Remove todos os marcadores (exceto o do usuário se houver)
  if (map) {
    map.eachLayer(layer => {
  if (layer instanceof L.Marker) {
    map.removeLayer(layer);
  }
    });
  }
});