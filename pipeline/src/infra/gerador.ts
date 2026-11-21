import { lastValueFrom, Subject, take, takeUntil, tap, timer } from "rxjs";
import { Pedido } from "../domain/eventos";
import { Barramento } from "./barramento";

export class GeradorPedidos {
    private aberto = true;
    private readonly parada = new Subject<void>();

    constructor(private readonly barramento: Barramento) {}

    publicar(pedido: Pedido): boolean {
        if (!this.aberto) {
            return false;
        }
        this.barramento.emitir({ tipo: "PedidoCriado", pedido });
        return true;
    }

    async gerar(pedidos: readonly Pedido[], intervaloMs: number): Promise<void> {
        if (this.aberto) {
            await lastValueFrom(timer(0, intervaloMs).pipe(
                take(pedidos.length),
                tap(indice => this.publicar(pedidos[indice])),
                takeUntil(this.parada),
            ), { defaultValue: undefined });
        }
    }

    encerrar(): void {
        this.aberto = false;
        this.parada.next();
        this.parada.complete();
    }
}
