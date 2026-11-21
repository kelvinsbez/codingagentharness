import {
  Subject, ignoreElements, lastValueFrom, take, takeUntil, tap, timer, type SchedulerLike,
} from "rxjs";
import { criarEvento } from "../domain/eventos";
import type { Pedido } from "../domain/pedido";
import type { Barramento } from "./barramento";

export function criarPedidosDeTeste(quantidade: number): Pedido[] {
  return Array.from({ length: quantidade }, (_, indice) => {
    const numero = indice + 1;
    return {
      id: `pedido-${numero}`,
      cliente: `cliente-${numero}@example.com`,
      itens: [{ produtoId: "livro", quantidade: 1 }],
    };
  });
}

export class GeradorPedidos {
  private readonly parada = new Subject<void>();
  private encerrado = false;

  constructor(
    private readonly barramento: Barramento,
    private readonly scheduler: SchedulerLike,
  ) {}

  publicar(pedido: Pedido): boolean {
    if (this.encerrado) {
      return false;
    }
    this.barramento.publicar(criarEvento("PedidoCriado", pedido, {}));
    return true;
  }

  async gerar(pedidos: readonly Pedido[], intervaloMs: number): Promise<void> {
    if (this.encerrado) {
      return;
    }

    await lastValueFrom(timer(0, intervaloMs, this.scheduler).pipe(
      take(pedidos.length),
      takeUntil(this.parada),
      tap((indice) => {
        const pedido = pedidos[indice];
        if (pedido) {
          this.publicar(pedido);
        }
      }),
      ignoreElements(),
    ), { defaultValue: undefined });
  }

  parar(): void {
    this.encerrado = true;
    this.parada.next();
    this.parada.complete();
  }
}
