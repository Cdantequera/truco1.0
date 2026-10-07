# 🃏 Truco Argentino (Online 1 vs 1 & Modo 1 vs PC)

Plataforma completa de **Truco Argentino** desarrollada con **Next.js 15**, **TypeScript**, **WebSockets (Socket.io)**, **Tailwind CSS**, **Framer Motion** y un motor de **Inteligencia Artificial adaptable**.

Permite jugar tanto en modo **Multijugador en Tiempo Real** (con arquitectura de servidor autoritativo y salas privadas/públicas) como en modo **1 vs PC (Offline)** con tres niveles de dificultad reglamentarios y naipes españoles vectoriales en SVG de alta definición.

---

## 🚀 Novedades y Características Principales

### 1. 🎴 Baraja Española en SVG de Alta Calidad
- Integración completa de los 40 naipes reglamentarios en formato vectorial SVG desde `spanish-playing-cards-svg` (alojados de forma nativa en `client/public/cards/`).
- Mapeo automatizado de palos y números: Espadas (`swords`), Bastos (`clubs`), Oros (`coins`) y Copas (`cups`), más el dorso tradicional (`card_back.svg`).
- Proporción reglamentaria (aspect ratio `66/102`) que garantiza nitidez total en pantallas móviles y monitores 4K sin pixelado.
- Animaciones fluidas con **Framer Motion** (levante táctil, escalado y selección).
- Iluminación con borde dorado (`ring-amber-400`) para cartas jugables en el turno activo.
- Distintivos criollos flotantes para las cartas bravas del Truco:
  - **Macho:** 1 de Espada (Poder 14)
  - **Hembra:** 1 de Basto (Poder 13)
  - **Manilla:** 7 de Espada (Poder 12) y 7 de Oro (Poder 11)

### 2. 🤖 Modo 1 vs PC (Offline / Sin Internet)
Permite jugar de inmediato contra la computadora directamente en el navegador, sin necesidad de conectarse al servidor ni esperar a otro jugador.
- **Selector de Dificultad:** Fácil, Medio y Difícil con heurísticas de juego reales.
- **Simulador de Latencia Humana:** El bot no responde de inmediato; incluye pausas calculadas (800ms a 1400ms) para emular el tiempo de reflexión de un jugador de carne y hueso.
- **Puntaje configurable:** Partidas rápidas a 15 puntos o completas a 30 puntos (con división de *Buenas* y *Malas*).

### 3. 🌐 Modo Multijugador Online (1 vs 1 en Tiempo Real)
- **Servidor Autoritativo:** Cero lógica en el cliente para evitar trampas. El servidor valida turnos, jerarquía de cantos y cartas.
- **Ocultamiento de Cartas:** El cliente jamás recibe los naipes del oponente por la red; solo recibe `cardCount` para renderizar el dorso.
- **Matchmaking Público ("Jugar Ya"):** Emparejamiento instantáneo con jugadores en espera.
- **Mesas Privadas con Código Corto:** Generación de códigos como `TRUCO-492` y enlaces compartibles (`/mesa/[roomId]`).
- **Control de Aforo y Desconexiones:** Máximo 2 jugadores por mesa y tolerancia de 45 segundos ante micro-cortes.

---

## 🧠 Niveles de Inteligencia Artificial del Bot (`trucoBot.ts`)

El bot está diseñado como una función pura que analiza la mano, el tanteador y la situación de la mesa:

| Nivel | Envido | Truco & Bazas | Bluffing / Mentira |
| :--- | :--- | :--- | :--- |
| **Fácil** *(Principiante)* | Solo canta o acepta con **28+ puntos**. | Juega plano: siempre tira su carta más débil primero. Solo canta o acepta Truco con Anchos o Manillas. | **0%** (Cero mentiras). |
| **Medio** *(Jugador de Peña)* | Acepta con **26+** (siendo Mano) o **27+** (siendo Pie). Con 31+ sube a Real Envido. | **Economía de cartas:** Si el rival ya tiró, mata con la carta mínima necesaria para no quemar cartas altas. Si no llega, va a menos. | **15%** en 2ª o 3ª ronda si el rival mostró debilidad. |
| **Difícil** *(Competitivo)* | **Lectura de tanteador:** En las malas arriesga con Falta Envido; en las buenas cuida los puntos. Prioriza mano en empates (25+). | **Estrategia de Primera:** "La primera vale dos". Si el rival quema un Ancho, regala su carta más baja para rematar con ventaja. Detecta y busca la **Parda** tácticamente si es Mano. | **25% - 30%** calculado aprovechando posición y debilidad del rival. |

---

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand.
- **Backend:** Node.js, Express, Socket.io, TypeScript (`tsx` para desarrollo).
- **Mazo y Gráficos:** SVG vectoriales españoles en `client/public/cards/`.

---

## 📂 Estructura del Proyecto

```text
truco1.0/
├── shared/
│   └── src/
│       └── types.ts             # Tipos TypeScript comunes (Card, Player, GameState, etc.)
├── server/
│   ├── src/
│   │   ├── engine/
│   │   │   ├── cards.ts         # Mazo de 40 cartas y jerarquía de poder (1 espada al 4)
│   │   │   ├── envido.ts        # Cálculo oficial de envido y desempate por mano
│   │   │   └── trucoEngine.ts   # Máquina de estados autoritativa (rondas, pardas, cantos)
│   │   ├── roomManager.ts       # Gestión de salas, aforo (máx 2) y grace period
│   │   └── server.ts            # Servidor Express + Socket.io con sanitización de red
│   └── package.json
├── client/
│   ├── public/
│   │   └── cards/               # 40 naipes españoles vectoriales + dorso (SVG)
│   ├── lib/
│   │   ├── engine/              # Motor de reglas local para partidas offline
│   │   │   ├── cards.ts
│   │   │   ├── envido.ts
│   │   │   └── trucoEngine.ts
│   │   ├── trucoBot.ts          # Módulo de Inteligencia Artificial (Fácil, Medio, Difícil)
│   │   └── offlineGameManager.ts# Controlador de partidas 1 vs PC con loop de turnos
│   ├── hooks/
│   │   ├── useSocket.ts         # Hook cliente Socket.io con ID persistente y fallback offline
│   │   └── useTrucoBot.ts       # Hook con simulador de latencia humana (800ms - 1500ms)
│   ├── components/
│   │   ├── Lobby.tsx            # Menú principal: Jugar vs PC, Jugar Online y Salas Privadas
│   │   ├── Board.tsx            # Tablero con paño verde, animación de cartas y toasts
│   │   ├── CardView.tsx         # Renderizador de cartas SVG con Framer Motion y distintivos
│   │   ├── ActionPanel.tsx      # Botonera contextual de cantos y respuestas en tiempo real
│   │   ├── ScoreBoard.tsx       # Tanteador criollo a 15/30 puntos (Buenas/Malas) y bazas
│   │   └── GameLogs.tsx         # Registro en vivo de jugadas y cantos
│   ├── store/
│   │   └── useGameStore.ts      # Estado reactivo global en Zustand
│   └── package.json
├── spanish-playing-cards-svg/   # Carpeta fuente original de cartas SVG
└── README.md
```

---

## 🎮 Cómo Jugar

### Opción A: Jugar 1 vs PC (Modo Offline)
No necesitás levantar el servidor backend para jugar contra la máquina:

1. Entrá a la carpeta `client`:
   ```bash
   cd client
   npm run dev
   ```
2. Abrí tu navegador en [http://localhost:3000](http://localhost:3000).
3. En el Lobby, ingresá tu nombre, seleccioná el puntaje (15 o 30) y elegí la dificultad de la IA (**Fácil**, **Medio** o **Difícil**).
4. Hacé clic en **"🤖 Jugar vs PC"**. ¡La partida comenzará de inmediato!

---

### Opción B: Jugar 1 vs 1 Online (Multijugador)

1. **Levantar el Servidor Backend (Puerto 4000):**
   En una terminal:
   ```bash
   cd server
   npm run dev
   ```
   > Verás: `🃏 SERVIDOR DE TRUCO ARGENTINO CORRIENDO EN PUERTO 4000`

2. **Levantar el Cliente Next.js (Puerto 3000):**
   En otra terminal:
   ```bash
   cd client
   npm run dev
   ```

3. **Abrir dos ventanas en el navegador:**
   - Ventana 1 (Jugador 1): [http://localhost:3000](http://localhost:3000)
   - Ventana 2 (Jugador 2, en modo incógnito): [http://localhost:3000](http://localhost:3000)
4. Hacé clic en **"🎲 Jugar Online (1 vs 1)"** en ambas ventanas, o creá una mesa privada en una y pegá el código en la otra.

---

## 📜 Escala Oficial de Cartas del Truco Argentino

De mayor a menor poder (14 a 1):
1. **1 de Espada** *(Poder 14 - Ancho de espada / Macho)*
2. **1 de Basto** *(Poder 13 - Ancho de basto / Hembra)*
3. **7 de Espada** *(Poder 12 - Manilla espada)*
4. **7 de Oro** *(Poder 11 - Manilla oro)*
5. **Todos los 3** *(Poder 10)*
6. **Todos los 2** *(Poder 9)*
7. **1 de Oro y 1 de Copa** *(Poder 8 - Falsos)*
8. **Todos los 12** *(Poder 7 - Reyes)*
9. **Todos los 11** *(Poder 6 - Caballos)*
10. **Todos los 10** *(Poder 5 - Sotas)*
11. **7 de Copa y 7 de Basto** *(Poder 4 - Falsos)*
12. **Todos los 6** *(Poder 3)*
13. **Todos los 5** *(Poder 2)*
14. **Todos los 4** *(Poder 1)*
