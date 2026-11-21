import type { Observable } from "rxjs";
import type { Pedido } from "./pedido";

export type ResultadoPagamento =
  | { readonly status: "aprovado"; readonly pagamentoId: string }
  | { readonly status: "recusado" };

export type ResultadoEstoque = "reservado" | "insuficiente";

export interface Servicos {
  readonly pagamento: {
    cobrar(pedido: Pedido): Observable<ResultadoPagamento>;
    estornar(pedido: Pedido, pagamentoId: string): Observable<void>;
  };
  readonly estoque: {
    reservar(pedido: Pedido): Observable<ResultadoEstoque>;
  };
  readonly transporte: {
    agendar(pedido: Pedido): Observable<void>;
  };
  readonly mensagens: {
    notificar(pedido: Pedido): Observable<void>;
  };
}
