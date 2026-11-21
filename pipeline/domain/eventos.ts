import { randomUUID } from "node:crypto";
import type { Pedido } from "./pedido";

type DadosEvento = {
  PedidoCriado: {};
  PagamentoAprovado: { pagamentoId: string };
  PagamentoRecusado: { motivo: "recusa" | "falha-tecnica" };
  EstoqueReservado: {};
  EstoqueInsuficiente: { pagamentoId: string };
  PagamentoEstornado: { pagamentoId: string };
  EnvioAgendado: {};
  NotificacaoEnviada: {};
};

export type TipoEvento = keyof DadosEvento;

export type EventoDe<Tipo extends TipoEvento> = {
  readonly tipo: Tipo;
  readonly eventId: string;
  readonly pedido: Pedido;
} & Readonly<DadosEvento[Tipo]>;

export type Evento = { [Tipo in TipoEvento]: EventoDe<Tipo> }[TipoEvento];

export function criarEvento<Tipo extends TipoEvento>(
  tipo: Tipo,
  pedido: Pedido,
  dados: DadosEvento[Tipo],
): EventoDe<Tipo> {
  return { ...dados, tipo, eventId: randomUUID(), pedido };
}
