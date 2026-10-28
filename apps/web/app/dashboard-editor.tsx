"use client";
import { Select } from "./components/select";
import { t as tr } from "./components/i18n";
import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { DashboardLayout } from "../../../packages/domain/src/dashboard.js";
type Props = {
  value: DashboardLayout;
  busy: boolean;
  save: (value: DashboardLayout) => Promise<void>;
  reset: () => Promise<void>;
  publish?: (value: DashboardLayout) => Promise<void>;
};
const catalog = [
  ["campaigns", "Kampanye terbaru"],
  ["delivery", "Hasil pengiriman"],
  ["budget", "Ringkasan anggaran"],
  ["activity", "Aktivitas tim"],
] as const;
export function DashboardEditor({ value, busy, save, reset, publish }: Props) {
  const [layout, setLayout] = useState(value);
  const items = [
    ...layout.widgets,
    ...catalog.map(([id]) => id).filter((id) => !layout.widgets.includes(id)),
  ];
  const move = (id: DashboardLayout["widgets"][number], direction: number) => {
    const widgets = [...layout.widgets];
    const from = widgets.indexOf(id),
      to = from + direction;
    if (to < 0 || to >= widgets.length) return;
    [widgets[from], widgets[to]] = [widgets[to], widgets[from]];
    setLayout({ ...layout, widgets });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(layout);
      }}
    >
      <p className="hint">
        {tr(
          "Pilih widget, ubah urutan, lalu atur lebarnya. Filter pesan tersimpan untuk akun Anda.",
        )}
      </p>
      <div className="layout-editor">
        {items.map((id) => {
          const active = layout.widgets.includes(id),
            index = layout.widgets.indexOf(id);
          return (
            <div key={id}>
              <label>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) =>
                    setLayout({
                      ...layout,
                      widgets: e.target.checked
                        ? [...layout.widgets, id]
                        : layout.widgets.filter((w) => w !== id),
                    })
                  }
                />
                {tr(catalog.find(([key]) => key === id)![1])}
              </label>
              <div className="layout-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={tr("Naikkan {0}", { "0": id })}
                  disabled={!active || index === 0}
                  onClick={() => move(id, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={tr("Turunkan {0}", { "0": id })}
                  disabled={!active || index === layout.widgets.length - 1}
                  onClick={() => move(id, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <Select
                  aria-label={tr("Lebar {0}", { "0": id })}
                  disabled={!active}
                  value={
                    layout.sizes[id] ??
                    (["campaigns", "activity"].includes(id) ? "full" : "half")
                  }
                  onChange={(e) =>
                    setLayout({
                      ...layout,
                      sizes: {
                        ...layout.sizes,
                        [id]: e.target.value as "half" | "full",
                      },
                    })
                  }
                >
                  <option value="half">{tr("Setengah")}</option>
                  <option value="full">{tr("Penuh")}</option>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
      <button className="primary full" disabled={busy}>
        {tr("Simpan tampilan")}
      </button>
      <div className="modal-actions">
        <button
          className="text-btn"
          type="button"
          disabled={busy}
          onClick={() => void reset()}
        >
          {tr("Pulihkan default perusahaan / peran")}
        </button>
        {publish && (
          <button
            className="text-btn"
            type="button"
            disabled={busy}
            onClick={() => void publish(layout)}
          >
            {tr("Jadikan default perusahaan")}
          </button>
        )}
      </div>
    </form>
  );
}
