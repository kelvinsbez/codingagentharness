export interface Pedido {
    readonly id: string;
    readonly cliente: string;
    readonly itens: readonly { readonly produtoId: string; readonly quantidade: number }[];
}

interface DadosPagamento {
    readonly cobrancaId: string;
}

interface DadosPorEvento {
    PedidoCriado: object;
    PagamentoAprovado: DadosPagamento;
    PagamentoRecusado: { readonly motivo: "negocio" | "falha-tecnica" };
    EstoqueReservado: object;
    EstoqueInsuficiente: DadosPagamento;
    PagamentoEstornado: DadosPagamento;
    EnvioAgendado: { readonly rastreio: string };
    NotificacaoEnviada: object;
}

export type TipoEvento = keyof DadosPorEvento;

type Eventos = {
    [Tipo in TipoEvento]: {
        readonly tipo: Tipo;
        readonly eventId: string;
        readonly pedido: Pedido;
    } & DadosPorEvento[Tipo];
}[TipoEvento];

export type Evento<T extends TipoEvento = TipoEvento> = Extract<Eventos, { tipo: T }>;
