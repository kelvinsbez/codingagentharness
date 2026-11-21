export interface Pedido {
  readonly id: string;
  readonly cliente: string;
  readonly itens: readonly {
    readonly produtoId: string;
    readonly quantidade: number;
  }[];
}
