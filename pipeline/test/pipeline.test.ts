import assert from "node:assert/strict";
import { test } from "node:test";
import { VirtualTimeScheduler, of } from "rxjs";
import { criarEvento, type Evento } from "../domain/eventos";
import type { Pedido } from "../domain/pedido";
import { conectarHandlers } from "../handlers/conectar";
import { Barramento } from "../infra/barramento";
import { criarServicosSimulados } from "../infra/servicos-simulados";
import { criarPipeline } from "../main";

const sucesso = [
  "PedidoCriado", "PagamentoAprovado", "EstoqueReservado", "EnvioAgendado", "NotificacaoEnviada",
];
const erroTecnico = new Error("Falha técnica simulada");

function pedido(id: string, quantidade = 1): Pedido {
  return { id, cliente: `${id}@example.com`, itens: [{ produtoId: "livro", quantidade }] };
}

function tipos(eventos: Evento[], id: string): string[] {
  return eventos.filter((evento) => evento.pedido.id === id).map(({ tipo }) => tipo);
}

function preparar(configuracao: Parameters<typeof criarServicosSimulados>[0] = {}) {
  const scheduler = new VirtualTimeScheduler();
  const servicos = criarServicosSimulados({ estoqueInicial: { livro: 20 }, ...configuracao }, scheduler);
  const pipeline = criarPipeline(servicos, scheduler);
  const eventos: Evento[] = [];
  pipeline.eventos$.subscribe((evento) => eventos.push(evento));
  return { scheduler, pipeline, eventos };
}

test("processa pedidos até a notificação com os eventos na ordem e IDs únicos", async () => {
  const { scheduler, pipeline, eventos } = preparar();
  pipeline.publicarPedido(pedido("A"));
  pipeline.publicarPedido(pedido("B"));
  scheduler.flush();
  await pipeline.encerrar();

  assert.deepEqual(tipos(eventos, "A"), sucesso);
  assert.deepEqual(tipos(eventos, "B"), sucesso);
  assert.equal(new Set(eventos.map(({ eventId }) => eventId)).size, eventos.length);
});

test("entrega os eventos na ordem com serviços síncronos mesmo ao encerrar durante a publicação", async () => {
  const pipeline = criarPipeline({
    pagamento: {
      cobrar: () => of({ status: "aprovado", pagamentoId: "pagamento" }),
      estornar: () => of(undefined),
    },
    estoque: { reservar: () => of("reservado") },
    transporte: { agendar: () => of(undefined) },
    mensagens: { notificar: () => of(undefined) },
  });
  const observados: string[] = [];
  const observador = pipeline.eventos$.subscribe(({ tipo }) => {
    observados.push(tipo);
    if (tipo === "PedidoCriado") {
      void pipeline.encerrar();
    }
  });

  assert.equal(pipeline.publicarPedido(pedido("A")), true);
  await pipeline.encerrar();

  assert.deepEqual(observados, sucesso);
  assert.equal(observador.closed, true);
});

test("trata recusa de negócio sem retry nem reserva", async () => {
  let cobrancas = 0;
  let reservas = 0;
  const { scheduler, pipeline, eventos } = preparar({
    cobrar: () => { cobrancas++; return { resultado: "recusado" }; },
    reservar: () => { reservas++; return undefined; },
  });
  pipeline.publicarPedido(pedido("A"));
  scheduler.flush();
  await pipeline.encerrar();

  assert.deepEqual(tipos(eventos, "A"), ["PedidoCriado", "PagamentoRecusado"]);
  assert.equal(cobrancas, 1);
  assert.equal(reservas, 0);
  const recusa = eventos.find((evento) => evento.tipo === "PagamentoRecusado");
  assert.equal(recusa?.motivo, "recusa");
});

test("estorna o pagamento correto quando dois pedidos disputam o mesmo estoque", async () => {
  let estornos = 0;
  const { scheduler, pipeline, eventos } = preparar({
    estoqueInicial: { livro: 1 },
    estornar: () => { estornos++; return undefined; },
  });
  pipeline.publicarPedido(pedido("A"));
  pipeline.publicarPedido(pedido("B"));
  scheduler.flush();
  await pipeline.encerrar();

  assert.deepEqual(tipos(eventos, "A"), sucesso);
  assert.deepEqual(tipos(eventos, "B"), [
    "PedidoCriado", "PagamentoAprovado", "EstoqueInsuficiente", "PagamentoEstornado",
  ]);
  const aprovado = eventos.find((evento) => evento.tipo === "PagamentoAprovado" && evento.pedido.id === "B");
  const estornado = eventos.find((evento) => evento.tipo === "PagamentoEstornado");
  assert.ok(aprovado?.tipo === "PagamentoAprovado" && estornado);
  assert.equal(estornado.pagamentoId, aprovado.pagamentoId);
  assert.equal(estornos, 1);
});

test("cancela uma tentativa após 2 s e reserva estoque somente no retry bem-sucedido", async () => {
  const chamadas: number[] = [];
  const { scheduler, pipeline, eventos } = preparar({
    estoqueInicial: { livro: 1 },
    reservar: (atual, chamada) => {
      chamadas.push(scheduler.now());
      return atual.id === "A" && chamada === 1 ? { atrasoMs: 2_001 } : undefined;
    },
  });
  pipeline.publicarPedido(pedido("A"));
  pipeline.publicarPedido(pedido("B"));
  scheduler.flush();
  await pipeline.encerrar();

  assert.deepEqual(chamadas, [0, 2_100, 2_100]);
  assert.deepEqual(tipos(eventos, "A"), sucesso);
  assert.deepEqual(tipos(eventos, "B"), [
    "PedidoCriado", "PagamentoAprovado", "EstoqueInsuficiente", "PagamentoEstornado",
  ]);
});

test("aplica timeout a cada tentativa e publica recusa técnica após quatro chamadas", async () => {
  const chamadas: number[] = [];
  const { scheduler, pipeline, eventos } = preparar({
    cobrar: (atual) => {
      if (atual.id === "válido") {
        return undefined;
      }
      chamadas.push(scheduler.now());
      return { atrasoMs: 2_001 };
    },
  });
  let instanteRecusa: number | undefined;
  pipeline.eventos$.subscribe((evento) => {
    if (evento.tipo === "PagamentoRecusado") {
      instanteRecusa = scheduler.now();
    }
  });

  pipeline.publicarPedido(pedido("lento"));
  pipeline.publicarPedido(pedido("válido"));
  scheduler.flush();
  await pipeline.encerrar();

  assert.deepEqual(chamadas, [0, 2_100, 4_300, 6_700]);
  assert.equal(instanteRecusa, 8_700);
  assert.deepEqual(tipos(eventos, "lento"), ["PedidoCriado", "PagamentoRecusado"]);
  assert.equal(eventos.find((evento) => evento.tipo === "PagamentoRecusado")?.motivo, "falha-tecnica");
  assert.deepEqual(tipos(eventos, "válido"), sucesso);
});

test("respeita os limites de cada handler inclusive quando há fila", async () => {
  const scheduler = new VirtualTimeScheduler();
  const casos = [
    { operacao: "cobrar", evento: criarEvento("PedidoCriado", pedido("A"), {}), limite: 5 },
    {
      operacao: "reservar",
      evento: criarEvento("PagamentoAprovado", pedido("A"), { pagamentoId: "pagamento" }),
      limite: 1,
    },
    { operacao: "agendar", evento: criarEvento("EstoqueReservado", pedido("A"), {}), limite: 5 },
    { operacao: "notificar", evento: criarEvento("EnvioAgendado", pedido("A"), {}), limite: 5 },
  ];

  for (const { operacao, evento, limite } of casos) {
    const barramento = new Barramento();
    const chamadas: number[] = [];
    const servicos = criarServicosSimulados({
      estoqueInicial: { livro: 20 },
      [operacao]: () => { chamadas.push(scheduler.now()); return { atrasoMs: 50 }; },
    }, scheduler);
    const assinaturas = conectarHandlers(barramento, servicos, scheduler);
    const inicio = scheduler.now();

    for (let i = 0; i < 7; i++) {
      barramento.publicar({ ...evento, eventId: `${evento.eventId}-${i}`, pedido: pedido(`P${i}`) });
    }
    assert.equal(chamadas.length, limite, operacao);
    scheduler.flush();
    assert.deepEqual(chamadas, Array.from({ length: 7 }, (_, i) =>
      inicio + 50 * Math.floor(i / limite)), operacao);
    assinaturas.unsubscribe();
    barramento.encerrar();
  }
});

test("cobrança e estorno dividem a fila do pagamento e o backoff mantém a vaga", async () => {
  const scheduler = new VirtualTimeScheduler();
  const barramento = new Barramento();
  const chamadas: Array<[string, number]> = [];
  const servicos = criarServicosSimulados({
    cobrar: (atual, chamada) => {
      chamadas.push([atual.id, scheduler.now()]);
      if (atual.id === "estornável") {
        return undefined;
      }
      return chamada === 1 ? { erro: erroTecnico } : { resultado: "recusado" };
    },
    estornar: () => { chamadas.push(["estorno", scheduler.now()]); return undefined; },
  }, scheduler);
  const assinaturas = conectarHandlers(barramento, servicos, scheduler);
  barramento.publicar(criarEvento("PedidoCriado", pedido("estornável"), {}));
  for (let i = 0; i < 5; i++) {
    barramento.publicar(criarEvento("PedidoCriado", pedido(`retry-${i}`), {}));
  }

  scheduler.flush();

  assert.deepEqual(chamadas.map(([, instante]) => instante), [0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100]);
  assert.deepEqual(chamadas.find(([id]) => id === "estorno"), ["estorno", 100]);
  assinaturas.unsubscribe();
  barramento.encerrar();
});

test("ignora cada evento repetido antes e depois da operação e aceita novos eventos do mesmo pedido", async () => {
  const scheduler = new VirtualTimeScheduler();
  const barramento = new Barramento();
  const chamadas: string[] = [];
  const registrar = (etapa: string, atual: Pedido) => {
    chamadas.push(`${etapa}-${atual.id}`);
    return { atrasoMs: 5 };
  };
  const servicos = criarServicosSimulados({
    estoqueInicial: { livro: 2 },
    cobrar: (atual) => registrar("cobrar", atual),
    reservar: (atual) => registrar("reservar", atual),
    agendar: (atual) => registrar("agendar", atual),
    notificar: (atual) => registrar("notificar", atual),
    estornar: (atual) => registrar("estornar", atual),
  }, scheduler);
  const assinaturas = conectarHandlers(barramento, servicos, scheduler);
  const recebidos = new Map<string, Evento>();
  const observador = barramento.eventos$.subscribe((evento) => {
    if (!recebidos.has(evento.eventId)) {
      recebidos.set(evento.eventId, evento);
      barramento.publicar({ ...evento });
    }
  });
  const original = pedido("A");
  barramento.publicar(criarEvento("PedidoCriado", original, {}));
  barramento.publicar(criarEvento("PedidoCriado", pedido("B", 3), {}));
  scheduler.flush();

  const esperadas = ["cobrar-A", "cobrar-B", "reservar-A", "agendar-A", "reservar-B", "notificar-A", "estornar-B"];
  assert.deepEqual(chamadas, esperadas);
  for (const evento of recebidos.values()) {
    barramento.publicar(evento);
  }
  scheduler.flush();
  assert.deepEqual(chamadas, esperadas);

  barramento.publicar(criarEvento("PedidoCriado", original, {}));
  scheduler.flush();
  assert.deepEqual(chamadas.slice(esperadas.length), ["cobrar-A", "reservar-A", "agendar-A", "notificar-A"]);
  observador.unsubscribe();
  assinaturas.unsubscribe();
  barramento.encerrar();
});

const etapasComFalha = [
  { operacao: "reservar", fluxo: sucesso.slice(0, 2) },
  { operacao: "agendar", fluxo: sucesso.slice(0, 3) },
  { operacao: "notificar", fluxo: sucesso.slice(0, 4) },
  { operacao: "estornar", fluxo: ["PedidoCriado", "PagamentoAprovado", "EstoqueInsuficiente"] },
];

for (const { operacao, fluxo } of etapasComFalha) {
  test(`isola a falha técnica em ${operacao} sem emitir sucesso ou compensação indevida`, async () => {
    const chamadas: number[] = [];
    const { scheduler, pipeline, eventos } = preparar({
      reservar: (atual) => operacao === "estornar" && atual.id === "falho"
        ? { resultado: "insuficiente" }
        : undefined,
      [operacao]: (atual: Pedido) => {
        if (atual.id === "falho") {
          chamadas.push(scheduler.now());
          throw erroTecnico;
        }
        return undefined;
      },
    });
    pipeline.publicarPedido(pedido("falho"));
    scheduler.flush();
    pipeline.publicarPedido(pedido("válido"));
    scheduler.flush();
    await pipeline.encerrar();

    assert.deepEqual(chamadas, [0, 100, 300, 700]);
    assert.deepEqual(tipos(eventos, "falho"), fluxo);
    assert.deepEqual(tipos(eventos, "válido"), sucesso);
  });
}

test("encerra a geração e aguarda fila, retry e eventos derivados antes de concluir", async () => {
  const { scheduler, pipeline, eventos } = preparar({
    reservar: (atual, tentativa) => atual.id === "A" && tentativa === 1
      ? { erro: erroTecnico, atrasoMs: 40 }
      : { atrasoMs: 20 },
    agendar: () => ({ atrasoMs: 30 }),
    notificar: () => ({ atrasoMs: 40 }),
  });
  let encerramento: Promise<void> | undefined;
  let concluido = false;
  const observador = pipeline.eventos$.subscribe({
    next(evento) {
      if (evento.tipo === "PedidoCriado" && evento.pedido.id === "B") {
        encerramento = pipeline.encerrar();
      }
    },
    complete() { concluido = true; },
  });
  const geracao = pipeline.gerarPedidos([pedido("A"), pedido("B"), pedido("C")], 10);
  scheduler.maxFrames = 50;
  scheduler.flush();
  await geracao;

  assert.ok(encerramento);
  assert.equal(pipeline.encerrar(), encerramento);
  assert.equal(pipeline.publicarPedido(pedido("D")), false);
  await pipeline.gerarPedidos([pedido("E")]);
  assert.equal(concluido, false);
  assert.equal(observador.closed, false);
  assert.deepEqual(tipos(eventos, "B"), sucesso.slice(0, 2));

  scheduler.maxFrames = Infinity;
  scheduler.flush();
  await encerramento;
  assert.deepEqual(tipos(eventos, "A"), sucesso);
  assert.deepEqual(tipos(eventos, "B"), sucesso);
  assert.deepEqual(eventos.filter(({ tipo }) => tipo === "PedidoCriado").map(({ pedido }) => pedido.id), ["A", "B"]);
  assert.equal(concluido, true);
  assert.equal(observador.closed, true);
  assert.equal(scheduler.now(), 250);
});
