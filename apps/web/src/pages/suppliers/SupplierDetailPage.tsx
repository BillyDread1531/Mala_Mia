import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listPurchases } from '../../api/purchases';
import { ApiError } from '../../api/client';
import { getSupplier, setSupplierActive, updateSupplier } from '../../api/suppliers';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { Purchase } from '../../types/purchase';
import type { SupplierListItem } from '../../types/supplier';
import './SupplierDetailPage.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const notify = useNotify();

  const [supplier, setSupplier] = useState<SupplierListItem | null>(null);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [address, setAddress] = useState('');
  const [social, setSocial] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  function fillForm(s: SupplierListItem) {
    setName(s.name);
    setPhone(s.phone ?? '');
    setWhatsapp(s.whatsapp ?? '');
    setContactPerson(s.contactPerson ?? '');
    setAddress(s.address ?? '');
    setSocial(s.social ?? '');
    setNotes(s.notes ?? '');
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([getSupplier(id), listPurchases({ supplierId: Number(id), pageSize: 50 })])
      .then(([supplierRes, purchasesRes]) => {
        setSupplier(supplierRes);
        fillForm(supplierRes);
        setPurchases(purchasesRes.items);
      })
      .catch((error: unknown) => {
        notify.error(
          error instanceof ApiError ? error.message : 'No se pudo cargar el proveedor.',
        );
      })
      .finally(() => setLoading(false));
  }, [id, notify]);

  async function handleSave() {
    if (!id || !name.trim()) {
      notify.error('El nombre del proveedor es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      // Se envían todos los campos (aunque queden vacíos): este formulario
      // reemplaza el estado completo de contacto, no es un parche parcial.
      // Si se usara `|| undefined` para omitir los vacíos, borrar un campo
      // (ej. quitar un WhatsApp) nunca llegaría a guardarse.
      const updated = await updateSupplier(id, {
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        contactPerson: contactPerson.trim(),
        address: address.trim(),
        social: social.trim(),
        notes: notes.trim(),
      });
      setSupplier((prev) => (prev ? { ...prev, ...updated } : prev));
      notify.success('Proveedor actualizado 💗');
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo actualizar el proveedor.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!id || !supplier) return;
    const nextActive = !supplier.isActive;
    if (
      !nextActive &&
      !window.confirm(
        `¿Desactivar a "${supplier.name}"? Las compras ya registradas conservan su historial.`,
      )
    ) {
      return;
    }
    setTogglingActive(true);
    try {
      const updated = await setSupplierActive(id, nextActive);
      setSupplier((prev) => (prev ? { ...prev, ...updated } : prev));
      notify.success(nextActive ? 'Proveedor reactivado.' : 'Proveedor desactivado.');
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo actualizar el estado.',
      );
    } finally {
      setTogglingActive(false);
    }
  }

  if (loading) {
    return <Loading fullPage label="Cargando proveedor…" />;
  }

  if (!supplier) {
    return (
      <Card>
        <p>No se encontró el proveedor.</p>
        <Link to="/proveedores">Volver a proveedores</Link>
      </Card>
    );
  }

  return (
    <div className="supplier-detail">
      <header className="supplier-detail__header">
        <div>
          <h1>{supplier.name}</h1>
          <Link to="/proveedores" className="supplier-detail__back">
            ← Volver a proveedores
          </Link>
        </div>
        <Button
          type="button"
          variant={supplier.isActive ? 'ghost' : 'secondary'}
          loading={togglingActive}
          onClick={() => void handleToggleActive()}
        >
          {supplier.isActive ? 'Desactivar' : 'Reactivar'}
        </Button>
      </header>

      <Card className="supplier-detail__stats">
        <div>
          <span className="supplier-detail__stat-label">Compras</span>
          <strong>{supplier.purchaseCount}</strong>
        </div>
        <div>
          <span className="supplier-detail__stat-label">Última compra</span>
          <strong>
            {supplier.lastPurchaseDate ? formatDate(supplier.lastPurchaseDate) : 'Sin compras'}
          </strong>
        </div>
        <div>
          <span className="supplier-detail__stat-label">Total comprado</span>
          <strong>{formatMoney(supplier.totalPurchased)}</strong>
        </div>
      </Card>

      <Card className="supplier-detail__form">
        <h2>Datos de contacto</h2>
        <div className="field">
          <label className="field__label" htmlFor="supplier-name">
            Nombre
          </label>
          <input
            id="supplier-name"
            className="field__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="supplier-detail__row">
          <div className="field">
            <label className="field__label" htmlFor="supplier-phone">
              Teléfono
            </label>
            <input
              id="supplier-phone"
              className="field__input"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="supplier-whatsapp">
              WhatsApp
            </label>
            <input
              id="supplier-whatsapp"
              className="field__input"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
            />
          </div>
        </div>
        <div className="supplier-detail__row">
          <div className="field">
            <label className="field__label" htmlFor="supplier-contact">
              Persona de contacto
            </label>
            <input
              id="supplier-contact"
              className="field__input"
              value={contactPerson}
              onChange={(event) => setContactPerson(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="supplier-social">
              Red social
            </label>
            <input
              id="supplier-social"
              className="field__input"
              value={social}
              onChange={(event) => setSocial(event.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="supplier-address">
            Dirección
          </label>
          <input
            id="supplier-address"
            className="field__input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="supplier-notes">
            Notas
          </label>
          <textarea
            id="supplier-notes"
            className="field__input"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <div className="supplier-detail__form-actions">
          <Button type="button" loading={saving} onClick={() => void handleSave()}>
            Guardar cambios
          </Button>
        </div>
      </Card>

      <Card className="supplier-detail__history">
        <h2>Historial de compras</h2>
        {!purchases || purchases.length === 0 ? (
          <EmptyState
            title="Sin compras todavía"
            description="Las compras que le hagas a este proveedor aparecerán aquí."
            showHeart={false}
          />
        ) : (
          <ul className="supplier-detail__purchase-list">
            {purchases.map((purchase) => (
              <li key={purchase.id}>
                <Link to={`/compras/${purchase.id}`} className="supplier-detail__purchase-row">
                  <div>
                    <span className="supplier-detail__purchase-number">
                      Compra #{purchase.purchaseNumber}
                    </span>
                    <span className="supplier-detail__purchase-date">
                      {formatDate(purchase.purchaseDate)} ·{' '}
                      {purchase.itemCount} línea{purchase.itemCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="supplier-detail__purchase-total">
                    {formatMoney(purchase.totalCost)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
