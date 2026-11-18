# Diseño de Picta

Picta está pensado para niñas y niños y sus familias en Bolivia. El tablero permite que los niños elijan pictogramas y los coloquen con instrucciones breves. La guía ayuda a madres, padres y cuidadores a acompañar esa experiencia y llevarla a situaciones cotidianas.

## Identidad visual

- La portada ofrece dos accesos. «Probar stickers» lleva al tablero y «Guía para familias» muestra ejemplos para acompañar al niño o niña. En el tablero, las palabras cortas, los pictogramas y los controles amplios ayudan a explorar y colocar los stickers por toque o teclado.

- El turquesa de marca `#05bfdd` es el color principal. Identifica el logo, las acciones y los filtros activos. La portada usa un degradado turquesa claro y el tablero de stickers usa una superficie azul muy pálida. El lavanda suave `#f1edf8` acompaña la franja de características, la guía de uso y la personalización. El azul oscuro `#006378` se usa en textos e iconos sobre fondos claros, y la tinta `#171c20` en textos sobre turquesa.
- La marca completa de la lámina se muestra en la cabecera y el pie.
- Mighty Slab es la referencia tipográfica del logo. Los titulares usan esa fuente cuando está instalada y cuentan con Caprasimo incluido localmente. Los textos, controles y etiquetas usan tipografía de sistema. [Caprasimo](https://github.com/docrepair-fonts/caprasimo-fonts)
- Los colores secundarios acompañan las colecciones y cada pictograma conserva su etiqueta. Las transiciones identifican cambios de estado y respetan la preferencia de movimiento reducido. [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/motion)
- El banco de stickers usa un fondo de papel punteado. El borde blanco sigue la silueta de cada dibujo. Al levantar un sticker se ve su sombra y, antes de soltarlo, se resalta la casilla que lo recibe.

`styles.css` define los tonos, la tipografía y el movimiento. `formats.css` reutiliza esos valores en los formatos, el formulario y las preguntas frecuentes.

## Bootstrap

El CSS compilado de Bootstrap 5.3.9 se carga desde `assets/vendor/bootstrap` antes de las hojas de Picta. Su cuadrícula organiza las colecciones, la guía de uso, los formatos y los campos del formulario. Las variantes de botones toman sus colores de `styles.css`. El menú, los stickers, los ejemplos y la personalización usan los scripts locales. [Bootstrap 5.3.9](https://blog.getbootstrap.com/2026/11/11/bootstrap-5-3-9/)

## Recursos y demo

La lámina original se guarda en `assets/picta-identidad.jpeg`. El navegador muestra directamente el logo de la referencia. La portada `assets/kit-picta.webp` es un mockup generado con ImageGen a partir de la lámina. Muestra la caja de tarjetas en crema y turquesa y tres pictogramas de una rutina de mañana. Las colecciones usan un atlas de cuatro objetos y la guía de uso reutiliza los pictogramas para mostrar ejemplos de Hogar, Escuela, Salud y Ciudad.

La página se abre desde `index.html`. El tablero de stickers se conserva en el navegador cuando hay almacenamiento local disponible. Los precios son orientativos y el resumen se genera en la página para descarga como TXT.

## Cuentas de clientes

La barra superior abre un diálogo en español con registro, confirmación por correo, inicio y cierre de sesión, recuperación de contraseña y edición del nombre. El diálogo reutiliza el logo, la imagen del kit y los colores de Picta. En móvil muestra el formulario a una columna.

Supabase Auth gestiona las credenciales. La migración `picta_clientes` vincula cada cuenta con un perfil en `public.clientes` y concede a cada cliente acceso a su propio perfil. La página carga la versión 2.119.0 del SDK oficial desde `assets/vendor/supabase` y usa la clave publicable del proyecto Picta Website.

Para probar los enlaces por correo en este equipo, sirve este directorio con `python -m http.server 3000 --bind 127.0.0.1` y entra por `http://localhost:3000/`. Para el registro público, configura la URL HTTPS del sitio y un proveedor SMTP en Supabase Auth. [URLs de redirección](https://supabase.com/docs/guides/auth/redirect-urls) [Correo SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
