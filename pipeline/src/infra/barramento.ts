import { randomUUID } from "node:crypto";
import { queueScheduler, Subject } from "rxjs";
import { Evento, TipoEvento } from "../domain/eventos";
import { Atividades } from "./atividades";

type NovoEvento = { [Tipo in TipoEvento]: Omit<Evento<Tipo>, "eventId"> }[TipoEvento];

export class Barramento {
    private readonly eventos = new Subject<Evento>();
    readonly eventos$ = this.eventos.asObservable();

    constructor(private readonly atividades: Atividades) {}

    publicar(evento: Evento): void {
        const concluir = this.atividades.registrar();
        // Entrega cada evento a todos os assinantes antes de despachar eventos decorrentes.
        queueScheduler.schedule(() => {
            try {
                this.eventos.next(evento);
            } finally {
                concluir();
            }
        });
    }

    emitir(evento: NovoEvento): void {
        this.publicar({ ...evento, eventId: randomUUID() });
    }

    encerrar(): void {
        this.eventos.complete();
    }
}
