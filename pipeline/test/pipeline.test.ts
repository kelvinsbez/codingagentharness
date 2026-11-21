import { finalize, map, of, Subscription, timer } from "rxjs";
import { Evento, Pedido } from "../src/domain/eventos";
import { iniciarEnvio } from "../src/handlers/envio";
import { iniciarEstoque } from "../src/handlers/estoque";
import { iniciarNotificacao } from "../src/handlers/notificacao";
import { iniciarPagamento } from "../src/handlers/pagamento";
import { Atividades } from "../src/infra/atividades";
import { Barramento } from "../src/infra/barramento";
import { Processamento } from "../src/infra/processamento";
import { criarServicosSimulados, Servicos } from "../src/infra/servicos";
import { criarSistema } from "../src/main";

const sucesso = [
    "PedidoCriado", "PagamentoAprovado", "EstoqueReservado", "EnvioAgendado", "NotificacaoEnviada",
];
const compensacao = ["PedidoCriado", "PagamentoAprovado", "EstoqueInsuficiente", "PagamentoEstornado"];
const falha = new Error("Serviço indisponível");

function pedido(id: string): Pedido {
    return { id, cliente: "cliente-" + id, itens: [{ produtoId: "produto", quantidade: 1 }] };
}

function iniciar(servicos: Servicos) {
    const sistema = criarSistema(servicos);
    const eventos: Evento[] = [];
    const completar = jest.fn();
    const observacao = sistema.eventos$.subscribe({
        next: evento => eventos.push(evento),
        complete: completar,
    });

    return { sistema, eventos, completar, observacao };
}

function fluxo(eventos: Evento[], id: string) {
    return eventos.filter(evento => evento.pedido.id === id).map(evento => evento.tipo);
}

beforeEach(() => jest.useFakeTimers({ now: 0 }));
afterEach(() => jest.useRealTimers());

test("processa pedidos até a notificação na ordem esperada e gera IDs únicos", async () => {
    const notificar = jest.fn(() => ({ valor: undefined }));
    const { sistema, eventos } = iniciar(criarServicosSimulados({
        estoqueInicial: { produto: 2 },
        agendar: p => ({ valor: "rastreio-" + p.id }),
        notificar,
    }));
    sistema.publicarPedido(pedido("a"));
    sistema.publicarPedido(pedido("b"));
    await sistema.encerrar();

    expect(fluxo(eventos, "a")).toEqual(sucesso);
    expect(fluxo(eventos, "b")).toEqual(sucesso);
    expect(eventos.every(evento => evento.eventId.length > 0)).toBe(true);
    expect(new Set(eventos.map(evento => evento.eventId)).size).toBe(eventos.length);
    expect(notificar.mock.calls).toEqual([[pedido("a"), "rastreio-a"], [pedido("b"), "rastreio-b"]]);
});

test("recusa de negócio encerra o pedido sem retry nem reserva", async () => {
    const cobrar = jest.fn(() => ({ valor: { aprovado: false as const } }));
    const reservar = jest.fn(() => ({ valor: "reservado" as const }));
    const { sistema, eventos } = iniciar(criarServicosSimulados({ cobrar, reservar }));
    sistema.publicarPedido(pedido("recusado"));
    await sistema.encerrar();

    expect(fluxo(eventos, "recusado")).toEqual(["PedidoCriado", "PagamentoRecusado"]);
    expect(eventos[1]).toMatchObject({ motivo: "negocio" });
    expect(cobrar).toHaveBeenCalledTimes(1);
    expect(reservar).not.toHaveBeenCalled();
});

test("dois pedidos disputam o estoque e a cobrança do pedido sem estoque é estornada", async () => {
    const { sistema, eventos } = iniciar(criarServicosSimulados({ estoqueInicial: { produto: 1 } }));
    sistema.publicarPedido(pedido("primeiro"));
    sistema.publicarPedido(pedido("segundo"));
    await sistema.encerrar();

    expect(fluxo(eventos, "primeiro")).toEqual(sucesso);
    expect(fluxo(eventos, "segundo")).toEqual(compensacao);
    const aprovacao = eventos.filter(evento => evento.tipo === "PagamentoAprovado")
        .find(evento => evento.pedido.id === "segundo");
    expect(eventos.find(evento => evento.tipo === "PagamentoEstornado")).toMatchObject({
        cobrancaId: aprovacao?.cobrancaId,
    });
});

test("cada timeout cancela a tentativa em 2 s e aplica os três intervalos exatos", async () => {
    const inicios: number[] = [];
    const cancelamentos: number[] = [];
    const servicos = criarServicosSimulados();
    const { sistema, eventos } = iniciar({
        ...servicos,
        pagamento: {
            ...servicos.pagamento,
            cobrar: () => {
                inicios.push(Date.now());
                return timer(2_001).pipe(
                    map(() => ({ aprovado: true as const, cobrancaId: "atrasada" })),
                    finalize(() => cancelamentos.push(Date.now())),
                );
            },
        },
    });
    sistema.publicarPedido(pedido("timeout"));
    const encerramento = sistema.encerrar();
    await jest.advanceTimersByTimeAsync(8_699);
    expect(fluxo(eventos, "timeout")).toEqual(["PedidoCriado"]);
    await jest.advanceTimersByTimeAsync(1);
    await encerramento;

    expect(inicios).toEqual([0, 2_100, 4_300, 6_700]);
    expect(cancelamentos).toEqual([2_000, 4_100, 6_300, 8_700]);
    expect(fluxo(eventos, "timeout")).toEqual(["PedidoCriado", "PagamentoRecusado"]);
    expect(eventos[1]).toMatchObject({ motivo: "falha-tecnica" });
    expect(jest.getTimerCount()).toBe(0);
});

test("recupera falha técnica do pagamento sem repetir a cobrança após sucesso", async () => {
    let tentativa = 0;
    const cobrar = jest.fn(() => ++tentativa === 1
        ? { erro: falha, atrasoMs: 10 }
        : { valor: { aprovado: true as const, cobrancaId: "aprovada" } });
    const { sistema, eventos } = iniciar(criarServicosSimulados({
        estoqueInicial: { produto: 1 }, cobrar,
    }));
    sistema.publicarPedido(pedido("recuperado"));
    const encerramento = sistema.encerrar();
    await jest.advanceTimersByTimeAsync(109);
    expect(cobrar).toHaveBeenCalledTimes(1);
    expect(fluxo(eventos, "recuperado")).toEqual(["PedidoCriado"]);
    await jest.advanceTimersByTimeAsync(1);
    await encerramento;

    expect(cobrar).toHaveBeenCalledTimes(2);
    expect(fluxo(eventos, "recuperado")).toEqual(sucesso);
});

const operacoes = [
    { nome: "pagamento", operacao: "cobrar", limite: 5, valor: { aprovado: true, cobrancaId: "teste" } },
    { nome: "estoque", operacao: "reservar", limite: 1, valor: "reservado" },
    { nome: "envio", operacao: "agendar", limite: 5, valor: "rastreio" },
    { nome: "notificação", operacao: "notificar", limite: 5, valor: undefined },
] as const;

test.each(operacoes)("respeita o limite de concorrência de $nome", async ({ operacao, limite, valor }) => {
    const iniciarOperacao = jest.fn(() => ({ atrasoMs: 10, valor }));
    const { sistema, eventos } = iniciar(criarServicosSimulados({
        estoqueInicial: { produto: 7 }, [operacao]: iniciarOperacao,
    }));
    const pedidos = Array.from({ length: 7 }, (_, indice) => pedido(String(indice)));
    pedidos.forEach(sistema.publicarPedido);
    const encerramento = sistema.encerrar();

    for (let restantes = pedidos.length; restantes > 0; restantes -= limite) {
        const iniciados = Math.min(pedidos.length - restantes + limite, pedidos.length);
        expect(iniciarOperacao).toHaveBeenCalledTimes(iniciados);
        await jest.advanceTimersByTimeAsync(9);
        expect(iniciarOperacao).toHaveBeenCalledTimes(iniciados);
        await jest.advanceTimersByTimeAsync(1);
    }
    await encerramento;
    pedidos.forEach(p => expect(fluxo(eventos, p.id)).toEqual(sucesso));
});

test("cobranças em retry e estornos compartilham o limite do pagamento", async () => {
    const cobrancas = new Set<string>();
    const estornar = jest.fn(() => ({ valor: undefined }));
    const cobrar = jest.fn((p: Pedido) => {
        if (p.id !== "compensado" && !cobrancas.has(p.id)) {
            cobrancas.add(p.id);
            return { erro: falha };
        }
        return { valor: { aprovado: true as const, cobrancaId: p.id } };
    });
    const { sistema, eventos } = iniciar(criarServicosSimulados({
        cobrar,
        estornar,
        reservar: p => p.id === "compensado"
            ? { valor: "insuficiente", atrasoMs: 10 }
            : { valor: "reservado" },
    }));
    sistema.publicarPedido(pedido("compensado"));
    for (let i = 0; i < 5; i++) {
        sistema.publicarPedido(pedido(String(i)));
    }
    const encerramento = sistema.encerrar();

    await jest.advanceTimersByTimeAsync(99);
    expect(cobrar).toHaveBeenCalledTimes(6);
    expect(estornar).not.toHaveBeenCalled();
    expect(fluxo(eventos, "compensado")).toEqual(compensacao.slice(0, 3));
    await jest.advanceTimersByTimeAsync(1);
    await encerramento;

    expect(estornar).toHaveBeenCalledTimes(1);
    expect(fluxo(eventos, "compensado")).toEqual(compensacao);
});

const falhasIsoladas = [
    { operacao: "reservar", parcial: sucesso.slice(0, 2) },
    { operacao: "agendar", parcial: sucesso.slice(0, 3) },
    { operacao: "notificar", parcial: sucesso.slice(0, 4) },
    { operacao: "estornar", parcial: compensacao.slice(0, 3) },
] as const;

test.each(falhasIsoladas)("isola falha técnica definitiva ao $operacao", async ({ operacao, parcial }) => {
    const tentativas: number[] = [];
    const darFalha = () => {
        tentativas.push(Date.now());
        throw falha;
    };
    const { sistema, eventos } = iniciar(criarServicosSimulados({
        reservar: p => {
            if (p.id === "falho") {
                if (operacao === "reservar") return darFalha();
                if (operacao === "estornar") return { valor: "insuficiente" };
            }
            return { valor: "reservado" };
        },
        agendar: p => p.id === "falho" && operacao === "agendar" ? darFalha() : { valor: p.id },
        notificar: p => p.id === "falho" && operacao === "notificar" ? darFalha() : { valor: undefined },
        estornar: darFalha,
    }));
    sistema.publicarPedido(pedido("falho"));
    sistema.publicarPedido(pedido("independente"));
    await jest.advanceTimersByTimeAsync(700);
    sistema.publicarPedido(pedido("posterior"));
    await sistema.encerrar();

    expect(tentativas).toEqual([0, 100, 300, 700]);
    expect(fluxo(eventos, "falho")).toEqual(parcial);
    expect(fluxo(eventos, "independente")).toEqual(sucesso);
    expect(fluxo(eventos, "posterior")).toEqual(sucesso);
});

test("deduplica cada evento recebido e processa IDs diferentes do mesmo pedido", async () => {
    const atividades = new Atividades();
    const barramento = new Barramento(atividades);
    const processamento = new Processamento(barramento, atividades);
    let cobrancas = 0;
    const cobrar = jest.fn(() => timer(10).pipe(
        map(() => ({ aprovado: true as const, cobrancaId: String(++cobrancas) })),
    ));
    const estornar = jest.fn(() => of(undefined));
    const reservar = jest.fn((p: Pedido) => of(p.id === "sem-estoque" ? "insuficiente" as const : "reservado" as const));
    const agendar = jest.fn(() => of("rastreio"));
    const notificar = jest.fn(() => of(undefined));
    const assinaturas = new Subscription();
    assinaturas.add(iniciarPagamento(barramento, processamento, { cobrar, estornar }));
    assinaturas.add(iniciarEstoque(barramento, processamento, { reservar }));
    assinaturas.add(iniciarEnvio(barramento, processamento, { agendar }));
    assinaturas.add(iniciarNotificacao(barramento, processamento, { notificar }));

    const entradas = new Set([
        "PedidoCriado", "PagamentoAprovado", "EstoqueReservado", "EstoqueInsuficiente", "EnvioAgendado",
    ]);
    const eventos = new Map<string, Evento>();
    assinaturas.add(barramento.eventos$.subscribe(evento => {
        if (!eventos.has(evento.eventId)) {
            eventos.set(evento.eventId, evento);
            if (entradas.has(evento.tipo)) barramento.publicar(evento);
        }
    }));

    barramento.emitir({ tipo: "PedidoCriado", pedido: pedido("mesmo") });
    barramento.emitir({ tipo: "PedidoCriado", pedido: pedido("mesmo") });
    barramento.emitir({ tipo: "PedidoCriado", pedido: pedido("sem-estoque") });
    await jest.advanceTimersByTimeAsync(10);
    await atividades.aguardar();
    for (const evento of eventos.values()) {
        if (entradas.has(evento.tipo)) barramento.publicar(evento);
    }
    await jest.runAllTimersAsync();
    await atividades.aguardar();
    assinaturas.unsubscribe();
    barramento.encerrar();

    expect(cobrar).toHaveBeenCalledTimes(3);
    expect(reservar).toHaveBeenCalledTimes(3);
    expect(agendar).toHaveBeenCalledTimes(2);
    expect(notificar).toHaveBeenCalledTimes(2);
    expect(estornar).toHaveBeenCalledTimes(1);
    expect([...eventos.values()].filter(evento => evento.tipo === "NotificacaoEnviada")).toHaveLength(2);
    expect(fluxo([...eventos.values()], "sem-estoque")).toEqual(compensacao);
});

test("encerramento para a geração e aguarda filas, retries e eventos decorrentes", async () => {
    let chamadas = 0;
    const { sistema, eventos, completar, observacao } = iniciar(criarServicosSimulados({
        reservar: p => p.id === "gerado" && ++chamadas === 1 ? { erro: falha } : { valor: "reservado" },
        notificar: () => ({ valor: undefined, atrasoMs: 20 }),
    }));
    const geracao = sistema.gerarPedidos([pedido("gerado"), pedido("nao-gerado")], 1_000);
    await jest.advanceTimersByTimeAsync(0);
    expect(sistema.publicarPedido(pedido("na-fila"))).toBe(true);
    const encerramento = sistema.encerrar();
    expect(sistema.encerrar()).toBe(encerramento);
    expect(sistema.publicarPedido(pedido("rejeitado"))).toBe(false);
    await geracao;
    await sistema.gerarPedidos([pedido("apos-parada")], 1);

    await jest.advanceTimersByTimeAsync(119);
    expect(completar).not.toHaveBeenCalled();
    expect(observacao.closed).toBe(false);
    expect(fluxo(eventos, "gerado")).toEqual(sucesso.slice(0, 4));
    await jest.advanceTimersByTimeAsync(1);
    await encerramento;

    expect(fluxo(eventos, "gerado")).toEqual(sucesso);
    expect(fluxo(eventos, "na-fila")).toEqual(sucesso);
    expect(eventos.filter(evento => evento.tipo === "PedidoCriado").map(evento => evento.pedido.id))
        .toEqual(["gerado", "na-fila"]);
    expect(completar).toHaveBeenCalledTimes(1);
    expect(observacao.closed).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
});

test("encerramento solicitado durante a publicação drena os eventos já enfileirados", async () => {
    const { sistema, eventos } = iniciar(criarServicosSimulados({ estoqueInicial: { produto: 1 } }));
    let encerramento: Promise<void> | undefined;
    sistema.eventos$.subscribe(evento => {
        if (evento.tipo === "PedidoCriado") encerramento = sistema.encerrar();
    });

    sistema.publicarPedido(pedido("em-publicacao"));
    expect(encerramento).toBeDefined();
    await encerramento;

    expect(fluxo(eventos, "em-publicacao")).toEqual(sucesso);
});
