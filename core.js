/* NEXUS-Oberfläche: Grundlegende Elemente (Zeichenfläche, Statuszeile).
   Klassisches Skript: teilt Variablen mit den anderen Dateien in ui/ (Reihenfolge siehe index.html). */
    const canvas = document.getElementById('orbCanvas');
    const ctx = canvas.getContext('2d');
    const app = document.getElementById('app');
    const frame = document.getElementById('circleFrame');
    const statusText = document.getElementById('statusText');
