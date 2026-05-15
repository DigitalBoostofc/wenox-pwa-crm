import { useEffect, useState } from 'react';
import { IonList, IonItem, IonLabel, IonButton, IonSelect, IonSelectOption } from '@ionic/react';
import { listEquipe, addMembro, removeMembro } from '@/equipe/equipeService';
import type { MembroEquipe } from '@/equipe/equipeService';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { useAuth } from '@/auth/useAuth';
import { canGerirEquipe } from '@/auth/perms';

export function EquipeTab({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const podeGerir = canGerirEquipe(user?.role);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sel, setSel] = useState('');

  async function carregar() {
    setMembros(await listEquipe(clienteId));
  }
  useEffect(() => {
    carregar();
    listUsuarios().then(setUsuarios);
  }, [clienteId]);

  async function add() {
    if (!sel) return;
    await addMembro(clienteId, sel, 'Outros');
    setSel('');
    await carregar();
  }
  async function rm(id: string) {
    await removeMembro(id);
    await carregar();
  }

  return (
    <div>
      {podeGerir && (
        <div style={{ display: 'flex', gap: 8, padding: 8 }}>
          <IonSelect
            aria-label="Selecionar usuário"
            placeholder="Adicionar membro"
            value={sel}
            onIonChange={(e) => setSel(e.detail.value)}
            style={{ flex: 1 }}
          >
            {usuarios.map((u) => (
              <IonSelectOption key={u.id} value={u.id}>{u.nome}</IonSelectOption>
            ))}
          </IonSelect>
          <IonButton onClick={add}>Add</IonButton>
        </div>
      )}
      <IonList>
        {membros.map((m) => (
          <IonItem key={m.id}>
            <IonLabel>
              <h3>{m.expand?.usuario?.nome ?? m.usuario}</h3>
              <p>{m.area}</p>
            </IonLabel>
            {podeGerir && (
              <IonButton slot="end" color="danger" fill="clear" onClick={() => rm(m.id)}>
                Remover
              </IonButton>
            )}
          </IonItem>
        ))}
      </IonList>
    </div>
  );
}
