const API_KEY = "30b99f74b7fc14df13379f47036ef238";

/* ---------------- Variables globales ---------------- */
let map;
let markers = [];
let circles = [];
let mapInitialized = false;
let ultimaBusqueda = null;

let perfilMap = null;
let perfilMarker = null;

/* ---------------- Mostrar pantalla ---------------- */
function mostrarPantalla(id) {
  document.querySelectorAll(".pantalla").forEach(p => p.classList.add("oculto"));
  document.getElementById(id).classList.remove("oculto");
}

/* ---------------- Login ---------------- */
function estaLogeado() {
  return !!localStorage.getItem("userId");
}

function actualizarEstadoLogin() {
  if (estaLogeado()) {
    mostrarPantalla("dashboard");
    document.getElementById("usernameDash").innerText = "Usuario: " + localStorage.getItem("username");
    cargarBusquedas();
    cargarPerfil();
  } else {
    mostrarPantalla("pantallaInicio");
  }
}

function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  fetch("http://localhost:3000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.userId) {
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("username", username);
      mostrarNotificacion("✅ Sesión iniciada", "success");
      actualizarEstadoLogin();
    } else {
      mostrarNotificacion("⚠️ Usuario o contraseña incorrectos", "error");
    }
  })
  .catch(err => console.error(err));
}

function register() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  fetch("http://localhost:3000/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.userId) {
      mostrarNotificacion("✅ Usuario registrado. Ahora inicia sesión", "success");
    } else {
      mostrarNotificacion("⚠️ Error en registro: " + (data.error || ""), "error");
    }
  });
}

function logout() {
  localStorage.removeItem("userId");
  localStorage.removeItem("username");
  mostrarNotificacion("⚠️ Sesión cerrada", "info");
  actualizarEstadoLogin();
}

/* ---------------- Notificaciones ---------------- */
function mostrarNotificacion(msg, tipo = "info") {
  const notif = document.createElement("div");
  notif.className = `notif ${tipo}`;
  notif.innerText = msg;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

/* ---------------- Mapas ---------------- */
function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  map = L.map('map').setView([19.4333, -99.1333], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=es`)
      .then(res => res.json())
      .then(data => { if (data.cod !== "404") mostrarEnMapa(lat, lon, data); })
      .catch(err => console.error(err));
  });
}

function mostrarMapa() {
  mostrarPantalla("mapContainer");
  initMap();
  setTimeout(() => map.invalidateSize(), 200);
  document.getElementById("ciudadInput").value = "";
}

function volverDashboard() {
  mostrarPantalla("dashboard");
}

function mostrarEnMapa(lat, lon, data) {
  const temp = data.main.temp;
  map.setView([lat, lon]);
  markers.forEach(m => map.removeLayer(m));
  circles.forEach(c => map.removeLayer(c));
  markers = [];
  circles = [];

  const circle = L.circle([lat, lon], {
    color: getColor(temp),
    fillColor: getColor(temp),
    fillOpacity: 0.5,
    radius: 50
  }).addTo(map);
  circles.push(circle);

  const marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup(`
    <b>${data.name}, ${data.sys.country}</b><br>
    🌡️ ${data.main.temp} °C<br>
    ☁️ ${data.weather[0].description}<br>
    💧 ${data.main.humidity}%<br>
    💨 ${data.wind.speed} m/s
  `).openPopup();
  markers.push(marker);

  ultimaBusqueda = {
    ciudad: data.name,
    lat,
    lon,
    temperatura: data.main.temp,
    descripcion: data.weather[0].description,
    humedad: data.main.humidity,
    velocidad_viento: data.wind.speed
  };
}

function getColor(temp) {
  if (temp <= 10) return '#1E90FF';
  if (temp <= 20) return '#00CED1';
  if (temp <= 30) return '#FFD700';
  return '#FF4500';
}

/* ---------------- Guardar búsqueda ---------------- */
function guardarBusqueda() {
  if (!ultimaBusqueda) {
    mostrarNotificacion("⚠️ No hay búsqueda activa para guardar", "error");
    return;
  }

  const userId = localStorage.getItem("userId");
  if (!userId) { 
    mostrarNotificacion("⚠️ Debes iniciar sesión para guardar la búsqueda", "error");
    return;
  }

  const payload = {
    userId,
    city: ultimaBusqueda.ciudad,
    lat: ultimaBusqueda.lat,
    lon: ultimaBusqueda.lon,
    temp: ultimaBusqueda.temperatura,
    description: ultimaBusqueda.descripcion,
    humidity: ultimaBusqueda.humedad,
    wind_speed: ultimaBusqueda.velocidad_viento
  };

  fetch("http://localhost:3000/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    mostrarNotificacion("✅ Búsqueda guardada correctamente", "success");
    cargarBusquedas();
  })
  .catch(err => {
    console.error(err);
    mostrarNotificacion("⚠️ Error al guardar búsqueda", "error");
  });
}

/* ---------------- Perfil con mapa ---------------- */
function mostrarPerfil() {
  mostrarPantalla("perfilPanel");
  cargarPerfil();
}

function cargarPerfil() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;

  fetch(`http://localhost:3000/perfiles/${userId}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("fechaNacimiento").value = data.fecha_nacimiento || "";
      document.getElementById("ciudadPerfil").value = data.ciudad || "";
      document.getElementById("estadoPerfil").value = data.estado || "";
      document.getElementById("paisPerfil").value = data.pais || "";
      document.getElementById("bioPerfil").value = data.bio || "";

      if (data.ciudad || data.estado || data.pais) {
        deshabilitarEdicion();
      } else {
        habilitarEdicion(); // para primer registro
      }
    });
}

function habilitarEdicion() {
  document.getElementById("fechaNacimiento").disabled = false;
  document.getElementById("bioPerfil").disabled = false;
  document.getElementById("paisPerfil").readOnly = true;
  document.getElementById("estadoPerfil").readOnly = true;
  document.getElementById("ciudadPerfil").readOnly = true;

  document.getElementById("mapPerfil").style.display = "block";

  if (!perfilMap) {
    perfilMap = L.map("mapPerfil").setView([19.4333, -99.1333], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(perfilMap);

    perfilMap.on('click', function(e) {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;

      if (perfilMarker) perfilMap.removeLayer(perfilMarker);
      perfilMarker = L.marker([lat, lon]).addTo(perfilMap);

      fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`)
        .then(res => res.json())
        .then(data => {
          if (data.length > 0) {
            const lugar = data[0];
            document.getElementById("ciudadPerfil").value = lugar.name || "";
            document.getElementById("estadoPerfil").value = lugar.state || "";
            document.getElementById("paisPerfil").value = lugar.country || "";
            document.getElementById("ciudadPerfil").dataset.lat = lat;
            document.getElementById("ciudadPerfil").dataset.lon = lon;
          }
        });
    });
  }

  setTimeout(() => perfilMap.invalidateSize(), 200);

  document.getElementById("btnEditarPerfil").disabled = true;
}

function deshabilitarEdicion() {
  document.getElementById("fechaNacimiento").disabled = true;
  document.getElementById("bioPerfil").disabled = true;
  document.getElementById("paisPerfil").readOnly = true;
  document.getElementById("estadoPerfil").readOnly = true;
  document.getElementById("ciudadPerfil").readOnly = true;

  document.getElementById("mapPerfil").style.display = "none";
  document.getElementById("btnEditarPerfil").disabled = false;
}

function guardarPerfil() {
  const userId = localStorage.getItem("userId");
  if (!userId) { mostrarNotificacion("⚠️ Debes iniciar sesión primero", "error"); return; }

  const fecha_nacimiento = document.getElementById("fechaNacimiento").value;
  const ciudad = document.getElementById("ciudadPerfil").value;
  const estado = document.getElementById("estadoPerfil").value;
  const pais = document.getElementById("paisPerfil").value;
  const bio = document.getElementById("bioPerfil").value;

  fetch("http://localhost:3000/perfiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, fecha_nacimiento, ciudad, estado, pais, bio })
  })
  .then(res => res.json())
  .then(data => {
    mostrarNotificacion(data.message, "success");
    deshabilitarEdicion();
  });
}

/* ---------------- Buscar ciudad ---------------- */
function buscarCiudad(ciudadParam) {
  const ciudad = ciudadParam || document.getElementById("ciudadInput").value;
  if (!ciudad) return;

  fetch(`https://api.openweathermap.org/data/2.5/weather?q=${ciudad}&appid=${API_KEY}&units=metric&lang=es`)
    .then(res => res.json())
    .then(data => {
      if (data.cod === 200) {
        mostrarEnMapa(data.coord.lat, data.coord.lon, data);
      } else {
        mostrarNotificacion("⚠️ Ciudad no encontrada", "error");
      }
    })
    .catch(err => console.error(err));
}


/* ---------------- Historial ---------------- */
function cargarBusquedas() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;
  fetch(`http://localhost:3000/historial/${userId}`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.querySelector("#busquedasTable tbody");
      tbody.innerHTML = "";
      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">No hay búsquedas guardadas</td></tr>`;
        return;
      }
      data.forEach(b => {
        const fecha = new Date(b.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${b.ciudad}</td><td>${b.temperatura} °C</td><td>${b.descripcion}</td><td>${b.humedad}%</td><td>${b.velocidad_viento} m/s</td><td>${fecha}</td>`;
        tbody.appendChild(tr);
      });
    });
}
/* ---------------- Historial ---------------- */
function mostrarHistorial() {
  mostrarPantalla("historialBusquedas");
  cargarBusquedas(); // 🔹 importante para que se muestren las búsquedas
}

function mostrarSugerenciasAPI() {
  const input = document.getElementById("ciudadInput").value;
  const sugerenciasList = document.getElementById("sugerenciasList");
  sugerenciasList.innerHTML = "";

  if (!input) return;

  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${input}&limit=5&appid=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      data.forEach(lugar => {
        const div = document.createElement("div");
        div.className = "sugerencia";
        div.innerText = `${lugar.name}, ${lugar.state || ""}, ${lugar.country}`;
        div.onclick = () => {
          document.getElementById("ciudadInput").value = `${lugar.name}, ${lugar.state || ""}`;
          sugerenciasList.innerHTML = "";

          // Buscamos usando lat/lon exactos
          buscarCiudadPorCoordenadas(lugar.lat, lugar.lon);
        };
        sugerenciasList.appendChild(div);
      });
    })
    .catch(err => console.error(err));
}

function buscarCiudadPorCoordenadas(lat, lon) {
  fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=es`)
    .then(res => res.json())
    .then(data => {
      if (data.cod === 200) {
        mostrarEnMapa(lat, lon, data);
      } else {
        mostrarNotificacion("⚠️ Ciudad no encontrada", "error");
      }
    })
    .catch(err => console.error(err));
}
function mostrarSugerenciasPerfil() {
  const input = document.getElementById("ciudadInputPerfil");
  const query = input.value.trim();
  const lista = document.getElementById("sugerenciasListPerfil");
  lista.innerHTML = "";

  if (!query) return;

  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      data.forEach(ciudad => {
        const div = document.createElement("div");
        div.textContent = `${ciudad.name}, ${ciudad.state || ""}, ${ciudad.country}`;
        div.addEventListener("click", () => {
          // Actualiza campos del perfil con coordenadas exactas
          document.getElementById("ciudadPerfil").value = ciudad.name;
          document.getElementById("estadoPerfil").value = ciudad.state || "";
          document.getElementById("paisPerfil").value = ciudad.country;
          document.getElementById("ciudadPerfil").dataset.lat = ciudad.lat;
          document.getElementById("ciudadPerfil").dataset.lon = ciudad.lon;

          // Muestra marcador en mapa de perfil
          if (perfilMarker) perfilMap.removeLayer(perfilMarker);
          perfilMarker = L.marker([ciudad.lat, ciudad.lon]).addTo(perfilMap);
          perfilMap.setView([ciudad.lat, ciudad.lon], 8);

          lista.innerHTML = "";
        });
        lista.appendChild(div);
      });
    })
    .catch(err => console.error(err));
}

function buscarCiudadPerfil() {
  const input = document.getElementById("ciudadInputPerfil").value;
  if (!input) return;

  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${input}&limit=1&appid=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      if (data.length > 0) {
        const ciudad = data[0];
        document.getElementById("ciudadPerfil").value = ciudad.name;
        document.getElementById("estadoPerfil").value = ciudad.state || "";
        document.getElementById("paisPerfil").value = ciudad.country;
        document.getElementById("ciudadPerfil").dataset.lat = ciudad.lat;
        document.getElementById("ciudadPerfil").dataset.lon = ciudad.lon;

        if (perfilMarker) perfilMap.removeLayer(perfilMarker);
        perfilMarker = L.marker([ciudad.lat, ciudad.lon]).addTo(perfilMap);
        perfilMap.setView([ciudad.lat, ciudad.lon], 8);
      } else {
        mostrarNotificacion("⚠️ Ciudad no encontrada", "error");
      }
    });
}





/* ---------------- Inicializar ---------------- */
window.onload = actualizarEstadoLogin;
