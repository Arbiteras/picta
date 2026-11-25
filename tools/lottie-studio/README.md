# Estudio Lottie de Picta

Copia local de Text-to-Lottie de Diffusion Studio. Usa Skia Skottie para reproducir y revisar las animaciones. La licencia original está en [LICENSE](LICENSE).

## Iniciar desde PowerShell

```powershell
cd "C:\Users\Rakyo\Desktop\Picta Proyect\tools\lottie-studio"
npm ci
npm run dev
```

Abre [el estudio en localhost](http://127.0.0.1:3031/). Solo necesitas ejecutar `npm ci` la primera vez o cuando cambie el archivo de dependencias.

## Crear una animación para Picta

1. Pulsa **+** junto a **Projects**, escribe un nombre y presiona Enter. Cada escena se guarda como `public/projects/<proyecto>/<escena>/lottie.json`.
2. Usa los SVG del sitio como referencia para iconos. Para stickers, toma los originales de `../../assets/stickers` (PNG) o `../../assets/pictograms` (WebP). Si la animación usa una imagen externa, coloca una copia junto a su `lottie.json`.
3. Actualiza el JSON de la escena con tu agente de código y revisa el resultado en el reproductor. También puedes arrastrar un Lottie existente en formato `.json` o `.lottie` sobre el lienzo de un proyecto para importarlo como otra escena.

## Escenas de Picta

- [Rutina de la mañana](http://127.0.0.1:3031/picta-rutina/scene-1) tiene una escena para cada uno de los tres pictogramas de la portada.
- [Tarjetas del panel](http://127.0.0.1:3031/picta-panel/scene-1) reúne Casa, Mochila y Libro.
- [Sello del tablero](http://127.0.0.1:3031/picta-tablero/scene-1) confirma la colocación de un sticker.

Las copias publicadas están en `../../assets/motion`. La rutina y el panel se componen de formas vectoriales editables. El sitio usa imágenes estáticas de esas mismas poses cuando la animación no se reproduce.

El estudio se ejecuta con su propio servidor. La página principal de Picta no necesita Vite ni CanvasKit.
