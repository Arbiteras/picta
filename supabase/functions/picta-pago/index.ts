const url = Deno.env.get("SUPABASE_URL")!;
const publishable = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

type Purchase = {
  id: string;
  total_centavos: number;
  estado: "pendiente" | "pagada" | "rechazada" | "vencida";
  entrega: "recojo" | "envio" | null;
  envio_centavos: number;
  direccion: string | null;
  lineas: { formato: string; nombre: string; cantidad: number; precio_centavos: number; paquete: number | null }[];
  vence_en: string;
};

class Failure extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function db(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: service, Authorization: `Bearer ${service}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const codes = [
      "carrito_invalido", "personalizacion_incompleta", "entrega_incompleta",
      "precio_actualizado", "compra_existente", "producto_no_disponible", "pago_no_coincide", "pago_cerrado",
      "compra_no_encontrada", "intento_invalido", "acceso_digital_activo",
      "paquete_digital_no_disponible",
    ];
    throw new Failure(response.status, codes.includes(data?.message) ? data.message : "no_se_pudo_registrar");
  }
  return data;
}

function present(purchase: Purchase) {
  const expire = purchase.estado === "pendiente" && Date.parse(purchase.vence_en) <= Date.now();
  return {
    id: purchase.id, total: purchase.total_centavos,
    estado: expire ? "vencida" : purchase.estado,
    entrega: purchase.entrega, envio: purchase.envio_centavos, direccion: purchase.direccion,
    lineas: purchase.lineas.map(({ formato, nombre, cantidad, precio_centavos, paquete }) =>
      ({ formato, nombre, cantidad, precio_centavos, paquete })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return respond({ error: "metodo_no_permitido" }, 405);
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new Failure(400, "compra_invalida");

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) throw new Failure(401, "inicia_sesion");
    const session = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: auth }, signal: AbortSignal.timeout(6000),
    });
    if (!session.ok) throw new Failure(401, "inicia_sesion");
    const user = await session.json();
    if (!uuid.test(user?.id || "") || user.is_anonymous) throw new Failure(401, "inicia_sesion");
    if (!uuid.test(body.id || "")) throw new Failure(400, "compra_invalida");

    if (body.accion === "crear") {
      if (!Array.isArray(body.lineas) || body.lineas.length > 8 || !Number.isSafeInteger(body.total)) {
        throw new Failure(400, "carrito_invalido");
      }
      const purchase: Purchase = await db("rpc/picta_preparar_compra", "POST", {
        p_id: body.id, p_cliente: user.id, p_lineas: body.lineas, p_total: body.total,
        p_entrega: body.entrega || null, p_direccion: body.direccion || null,
      });
      return respond(present(purchase));
    }
    if (body.accion === "pagar_tarjeta") {
      if (typeof body.intento !== "string" || !uuid.test(body.intento) ||
          Object.keys(body).some((key) => !["accion", "id", "intento"].includes(key))) {
        throw new Failure(400, "intento_invalido");
      }
      const payment: { compra: Purchase; resultado: string | null } = await db("rpc/picta_pagar_tarjeta", "POST", {
        p_id: body.id, p_cliente: user.id, p_intento: body.intento,
      });
      return respond({ ...present(payment.compra), resultado: payment.resultado });
    }
    if (body.accion === "estado") {
      const [purchase]: Purchase[] = await db(`picta_compras?id=eq.${body.id}&cliente_id=eq.${user.id}`);
      if (!purchase) throw new Failure(404, "compra_no_encontrada");
      return respond(present(purchase));
    }
    throw new Failure(400, "accion_no_disponible");
  } catch (error) {
    if (error instanceof Failure) return respond({ error: error.code }, error.status);
    console.error("checkout_error", error instanceof Error ? error.name : "unknown");
    return respond({ error: "servicio_no_disponible" }, 500);
  }
});
