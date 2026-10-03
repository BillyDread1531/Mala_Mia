import { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useNotify } from '../../notifications/useNotify';
import { ApiError } from '../../api/client';
import './SettingsPage.css';

interface NamedItem {
  id: string;
  name: string;
  isActive: boolean;
}

interface NamedListManagerProps<T extends NamedItem> {
  items: T[];
  onCreate: (name: string) => Promise<T>;
  onToggle: (item: T, isActive: boolean) => Promise<T>;
  onChanged: (items: T[]) => void;
  createPlaceholder: string;
  createLabel: string;
  confirmMessage: (item: T) => string;
}

/** Lista reutilizada para categorías, tallas, colores y categorías de
 * gasto: todas son "un nombre que se puede crear y activar/desactivar". */
export function NamedListManager<T extends NamedItem>({
  items,
  onCreate,
  onToggle,
  onChanged,
  createPlaceholder,
  createLabel,
  confirmMessage,
}: NamedListManagerProps<T>) {
  const notify = useNotify();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) {
      notify.error('Escribe un nombre.');
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate(newName.trim());
      onChanged([...items, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      notify.success('Creado correctamente 💗');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(item: T) {
    const nextActive = !item.isActive;
    if (nextActive === false && !window.confirm(confirmMessage(item))) {
      return;
    }
    setTogglingId(item.id);
    try {
      const updated = await onToggle(item, nextActive);
      onChanged(items.map((i) => (i.id === item.id ? updated : i)));
      notify.success('Configuración actualizada 💗');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo actualizar.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="settings__list">
        {items.map((item) => (
          <div key={item.id} className="settings__list-item">
            <div className="settings__list-name">
              <span>{item.name}</span>
              <span
                className={`settings__badge settings__badge--${item.isActive ? 'active' : 'inactive'}`}
              >
                {item.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              loading={togglingId === item.id}
              onClick={() => void handleToggle(item)}
            >
              {item.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        ))}
      </div>
      <div className="settings__create-form">
        <Input
          label={createLabel}
          placeholder={createPlaceholder}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <Button type="button" loading={creating} onClick={() => void handleCreate()}>
          Crear
        </Button>
      </div>
    </div>
  );
}
