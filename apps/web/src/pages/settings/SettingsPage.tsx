import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { changePassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import {
  createCategory,
  createColor,
  createExpenseCategory,
  createSize,
  listAllCategories,
  listAllColors,
  listAllExpenseCategories,
  listAllPaymentMethods,
  listAllSizes,
  setCategoryActive,
  setColorActive,
  setExpenseCategoryActive,
  setPaymentMethodActive,
  setSizeActive,
} from '../../api/catalog';
import { getGeneralSettings, updateGeneralSettings } from '../../api/settings';
import { listUsers, setUserActive } from '../../api/users';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useAuth } from '../../auth/useAuth';
import { useNotify } from '../../notifications/useNotify';
import type { Category, Color, ExpenseCategory, PaymentMethod, Size } from '../../types/catalog';
import type { GeneralSettings } from '../../types/settings';
import type { AppUser } from '../../types/user';
import { NamedListManager } from './NamedListManager';
import './SettingsPage.css';

interface SectionProps {
  icon: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

function SettingsCard({ icon, title, subtitle, children }: SectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="settings__card-header">
        <div>
          <div className="settings__card-title">
            <span className="settings__card-icon" aria-hidden="true">
              {icon}
            </span>
            {title}
          </div>
          <p className="settings__card-subtitle">{subtitle}</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => setOpen((prev) => !prev)}>
          {open ? 'Cerrar' : 'Administrar'}
        </Button>
      </div>
      {open ? <div className="settings__card-body">{children}</div> : null}
    </Card>
  );
}

function BusinessSection() {
  const notify = useNotify();
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [receiptMessage, setReceiptMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGeneralSettings()
      .then((s) => {
        setSettings(s);
        setBusinessName(s.businessName);
        setReceiptMessage(s.receiptMessage);
      })
      .catch(() => notify.error('No se pudo cargar la configuración del negocio.'));
  }, [notify]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateGeneralSettings({ businessName, receiptMessage });
      setSettings(updated);
      notify.success('Configuración actualizada 💗');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <Loading label="Cargando…" />;

  return (
    <>
      <Input
        label="Nombre del negocio"
        value={businessName}
        onChange={(event) => setBusinessName(event.target.value)}
      />
      <div className="field">
        <label className="field__label" htmlFor="receipt-message">
          Mensaje del comprobante
        </label>
        <textarea
          id="receipt-message"
          className="field__input"
          rows={2}
          value={receiptMessage}
          onChange={(event) => setReceiptMessage(event.target.value)}
        />
      </div>
      <div className="settings__form-actions">
        <Button type="button" loading={saving} onClick={() => void handleSave()}>
          Guardar cambios
        </Button>
      </div>
    </>
  );
}

function SalesInventorySection() {
  const notify = useNotify();
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [margin, setMargin] = useState('');
  const [threshold, setThreshold] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGeneralSettings()
      .then((s) => {
        setSettings(s);
        setMargin(String(s.targetProfitMargin));
        setThreshold(String(s.lowStockThreshold));
        setShippingFee(String(s.defaultShippingFee));
      })
      .catch(() => notify.error('No se pudo cargar la configuración.'));
  }, [notify]);

  const marginNumber = Number(margin) || 0;
  const examplePrice = marginNumber < 100 ? 65 / (1 - marginNumber / 100) : null;

  async function handleSave() {
    const marginValue = Number(margin);
    const thresholdValue = Number(threshold);
    const shippingFeeValue = Number(shippingFee);
    if (Number.isNaN(marginValue) || marginValue < 0 || marginValue >= 100) {
      notify.error('El margen debe estar entre 0 y 99.99%.');
      return;
    }
    if (!Number.isInteger(thresholdValue) || thresholdValue < 0) {
      notify.error('El umbral de stock bajo debe ser un número entero, 0 o mayor.');
      return;
    }
    if (Number.isNaN(shippingFeeValue) || shippingFeeValue < 0) {
      notify.error('El envío sugerido debe ser 0 o mayor.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateGeneralSettings({
        targetProfitMargin: marginValue,
        lowStockThreshold: thresholdValue,
        defaultShippingFee: shippingFeeValue,
      });
      setSettings(updated);
      notify.success('Configuración actualizada 💗');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <Loading label="Cargando…" />;

  return (
    <>
      <div className="settings__row">
        <Input
          label="Margen recomendado (%)"
          type="number"
          min="0"
          max="99.99"
          step="0.01"
          value={margin}
          onChange={(event) => setMargin(event.target.value)}
        />
        <Input
          label="Umbral de stock bajo (unidades)"
          type="number"
          min="0"
          step="1"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
        />
        <Input
          label="Envío sugerido (Q)"
          type="number"
          min="0"
          step="0.01"
          value={shippingFee}
          onChange={(event) => setShippingFee(event.target.value)}
        />
      </div>
      {examplePrice ? (
        <p className="settings__card-subtitle">
          Ejemplo: costo Q65 con {marginNumber}% de margen → precio recomendado Q
          {examplePrice.toFixed(2)}.
        </p>
      ) : null}
      <div className="settings__form-actions">
        <Button type="button" loading={saving} onClick={() => void handleSave()}>
          Guardar cambios
        </Button>
      </div>
    </>
  );
}

function CatalogSection() {
  const notify = useNotify();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [sizes, setSizes] = useState<Size[] | null>(null);
  const [colors, setColors] = useState<Color[] | null>(null);

  useEffect(() => {
    Promise.all([listAllCategories(), listAllSizes(), listAllColors()])
      .then(([cats, szs, cols]) => {
        setCategories(cats);
        setSizes(szs);
        setColors(cols);
      })
      .catch(() => notify.error('No se pudo cargar el catálogo.'));
  }, [notify]);

  if (!categories || !sizes || !colors) return <Loading label="Cargando…" />;

  return (
    <>
      <div className="settings__subsection">
        <h3>Categorías</h3>
        <NamedListManager
          items={categories}
          onCreate={createCategory}
          onToggle={(item, isActive) => setCategoryActive(item.id, isActive)}
          onChanged={setCategories}
          createLabel="Nueva categoría"
          createPlaceholder="Ej. Accesorios"
          confirmMessage={(item) =>
            `¿Desactivar la categoría "${item.name}"? Los productos que ya la usan conservan su historial.`
          }
        />
      </div>
      <div className="settings__subsection">
        <h3>Tallas</h3>
        <NamedListManager
          items={sizes}
          onCreate={createSize}
          onToggle={(item, isActive) => setSizeActive(item.id, isActive)}
          onChanged={setSizes}
          createLabel="Nueva talla"
          createPlaceholder="Ej. 2XL"
          confirmMessage={(item) => `¿Desactivar la talla "${item.name}"?`}
        />
      </div>
      <div className="settings__subsection">
        <h3>Colores</h3>
        <NamedListManager
          items={colors}
          onCreate={createColor}
          onToggle={(item, isActive) => setColorActive(item.id, isActive)}
          onChanged={setColors}
          createLabel="Nuevo color"
          createPlaceholder="Ej. Turquesa"
          confirmMessage={(item) => `¿Desactivar el color "${item.name}"?`}
        />
      </div>
    </>
  );
}

function PaymentMethodsSection() {
  const notify = useNotify();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    listAllPaymentMethods()
      .then(setMethods)
      .catch(() => notify.error('No se pudieron cargar las formas de pago.'));
  }, [notify]);

  async function handleToggle(method: PaymentMethod) {
    const nextActive = !method.isActive;
    if (
      !nextActive &&
      !window.confirm(`¿Desactivar "${method.name}"? Las ventas/compras ya registradas no cambian.`)
    ) {
      return;
    }
    setTogglingId(method.id);
    try {
      const updated = await setPaymentMethodActive(method.id, nextActive);
      setMethods((prev) => prev?.map((m) => (m.id === method.id ? updated : m)) ?? null);
      notify.success('Configuración actualizada 💗');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo actualizar.');
    } finally {
      setTogglingId(null);
    }
  }

  if (!methods) return <Loading label="Cargando…" />;

  return (
    <div className="settings__list">
      {methods.map((method) => (
        <div key={method.id} className="settings__list-item">
          <div className="settings__list-name">
            <span>{method.name}</span>
            <div className="settings__context-badges">
              {method.appliesToSales ? <span className="settings__context-badge">Ventas</span> : null}
              {method.appliesToPurchases ? (
                <span className="settings__context-badge">Compras</span>
              ) : null}
              {method.appliesToExpenses ? (
                <span className="settings__context-badge">Gastos</span>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            loading={togglingId === method.id}
            onClick={() => void handleToggle(method)}
          >
            {method.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ))}
    </div>
  );
}

function ExpenseCategoriesSection() {
  const notify = useNotify();
  const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);

  useEffect(() => {
    listAllExpenseCategories()
      .then(setCategories)
      .catch(() => notify.error('No se pudieron cargar las categorías de gasto.'));
  }, [notify]);

  if (!categories) return <Loading label="Cargando…" />;

  return (
    <NamedListManager
      items={categories}
      onCreate={createExpenseCategory}
      onToggle={(item, isActive) => setExpenseCategoryActive(item.id, isActive)}
      onChanged={setCategories}
      createLabel="Nueva categoría de gasto"
      createPlaceholder="Ej. Capacitación"
      confirmMessage={(item) =>
        `¿Desactivar "${item.name}"? Los gastos ya registrados conservan su historial.`
      }
    />
  );
}

function UsersSection() {
  const notify = useNotify();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => notify.error('No se pudieron cargar los usuarios.'));
  }, [notify]);

  async function handleToggle(targetUser: AppUser) {
    const nextActive = !targetUser.isActive;
    if (!nextActive && !window.confirm(`¿Desactivar el acceso de ${targetUser.fullName}?`)) {
      return;
    }
    setTogglingId(targetUser.id);
    try {
      const updated = await setUserActive(targetUser.id, nextActive);
      setUsers((prev) => prev?.map((u) => (u.id === targetUser.id ? updated : u)) ?? null);
      notify.success('Configuración actualizada 💗');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo actualizar.');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      notify.error('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      notify.success('Contraseña actualizada 💗');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setChangingPassword(false);
    }
  }

  if (!users) return <Loading label="Cargando…" />;

  return (
    <>
      <div className="settings__subsection">
        <h3>Usuarios con acceso</h3>
        <div className="settings__list">
          {users.map((u) => (
            <div key={u.id} className="settings__list-item">
              <div className="settings__list-name">
                <span>
                  {u.fullName} {u.id === currentUser?.id ? '(tú)' : ''}
                </span>
                <span
                  className={`settings__badge settings__badge--${u.isActive ? 'active' : 'inactive'}`}
                >
                  {u.isActive ? 'Activo' : 'Inactivo'} · {u.role}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={u.id === currentUser?.id}
                loading={togglingId === u.id}
                onClick={() => void handleToggle(u)}
              >
                {u.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings__subsection">
        <h3>Cambiar mi contraseña</h3>
        <Input
          label="Contraseña actual"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <Input
          label="Contraseña nueva"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <div className="settings__form-actions">
          <Button
            type="button"
            loading={changingPassword}
            onClick={() => void handleChangePassword()}
          >
            Guardar cambios
          </Button>
        </div>
      </div>
    </>
  );
}

export function SettingsPage() {
  return (
    <div className="settings">
      <header className="settings__header">
        <h1>Configuración</h1>
        <p>Ajustes de MALA MÍA que cambian de vez en cuando.</p>
      </header>

      <div className="settings__cards">
        <SettingsCard icon="🏪" title="Negocio" subtitle="Información básica de MALA MÍA">
          <BusinessSection />
        </SettingsCard>

        <SettingsCard
          icon="💰"
          title="Ventas e inventario"
          subtitle="Margen recomendado · Stock bajo"
        >
          <SalesInventorySection />
        </SettingsCard>

        <Card>
          <div className="settings__card-header">
            <div>
              <div className="settings__card-title">
                <span className="settings__card-icon" aria-hidden="true">
                  💸
                </span>
                Finanzas
              </div>
              <p className="settings__card-subtitle">Mi dinero · Reinversión · Reserva</p>
            </div>
            <Link to="/finanzas">
              <Button type="button" variant="ghost">
                Administrar
              </Button>
            </Link>
          </div>
        </Card>

        <SettingsCard icon="👗" title="Catálogo" subtitle="Categorías · Tallas · Colores">
          <CatalogSection />
        </SettingsCard>

        <SettingsCard icon="💳" title="Métodos de pago" subtitle="Disponibles para ventas y compras/gastos">
          <PaymentMethodsSection />
        </SettingsCard>

        <SettingsCard
          icon="🧾"
          title="Categorías de gastos"
          subtitle="Usadas al registrar gastos en Finanzas"
        >
          <ExpenseCategoriesSection />
        </SettingsCard>

        <SettingsCard icon="👤" title="Usuarios" subtitle="Quién puede acceder a MALA MÍA">
          <UsersSection />
        </SettingsCard>
      </div>
    </div>
  );
}
