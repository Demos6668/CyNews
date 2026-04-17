import { useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PRODUCT_CATEGORIES = [
  "Operating System",
  "Web Server",
  "Database",
  "Email Server",
  "Firewall",
  "VPN",
  "CRM",
  "ERP",
  "Cloud Platform",
  "Container Platform",
  "CI/CD",
  "Monitoring",
  "Security Tool",
  "Collaboration",
  "Other",
];

const COMMON_PRODUCTS = [
  { name: "Microsoft Exchange", vendor: "Microsoft", category: "Email Server" },
  { name: "Microsoft 365", vendor: "Microsoft", category: "Collaboration" },
  { name: "Windows Server", vendor: "Microsoft", category: "Operating System" },
  { name: "Apache", vendor: "Apache", category: "Web Server" },
  { name: "Nginx", vendor: "Nginx", category: "Web Server" },
  { name: "MySQL", vendor: "Oracle", category: "Database" },
  { name: "PostgreSQL", vendor: "PostgreSQL", category: "Database" },
  { name: "MongoDB", vendor: "MongoDB", category: "Database" },
  { name: "AWS", vendor: "Amazon", category: "Cloud Platform" },
  { name: "Azure", vendor: "Microsoft", category: "Cloud Platform" },
  { name: "GCP", vendor: "Google", category: "Cloud Platform" },
  { name: "VMware vSphere", vendor: "VMware", category: "Virtualization" },
  { name: "Citrix", vendor: "Citrix", category: "VPN" },
  { name: "Fortinet FortiGate", vendor: "Fortinet", category: "Firewall" },
  { name: "Palo Alto", vendor: "Palo Alto", category: "Firewall" },
  { name: "Cisco ASA", vendor: "Cisco", category: "Firewall" },
  { name: "Kubernetes", vendor: "CNCF", category: "Container Platform" },
  { name: "Docker", vendor: "Docker", category: "Container Platform" },
  { name: "Jenkins", vendor: "Jenkins", category: "CI/CD" },
  { name: "GitLab", vendor: "GitLab", category: "CI/CD" },
];

interface ProductEntry {
  id: number;
  name: string;
  vendor?: string;
  version?: string;
  category: string;
}

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; domain: string; description?: string; products?: ProductEntry[] }) => void;
}

export function CreateWorkspaceModal({ isOpen, onClose, onCreate }: CreateWorkspaceModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    description: "",
  });
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    vendor: "",
    version: "",
    category: "Other",
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const titleId = useId();
  const nameId = useId();
  const domainId = useId();
  const descriptionId = useId();
  const productsLabelId = useId();
  const productNameId = useId();
  const productVendorId = useId();
  const productVersionId = useId();
  const productCategoryId = useId();

  const resetForm = () => {
    setFormData({ name: "", domain: "", description: "" });
    setProducts([]);
    setNewProduct({ name: "", vendor: "", version: "", category: "Other" });
    setShowSuggestions(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddProduct = () => {
    if (!newProduct.name.trim()) return;
    setProducts((prev) => [
      ...prev,
      { ...newProduct, id: Date.now(), category: newProduct.category },
    ]);
    setNewProduct({ name: "", vendor: "", version: "", category: "Other" });
  };

  const handleAddSuggested = (p: (typeof COMMON_PRODUCTS)[0]) => {
    if (products.some((x) => x.name === p.name)) return;
    setProducts((prev) => [...prev, { ...p, id: Date.now(), category: p.category }]);
  };

  const handleRemoveProduct = (id: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      name: formData.name.trim(),
      domain: formData.domain.trim(),
      description: formData.description.trim() || undefined,
      products: products.length > 0 ? products : undefined,
    });
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border">
          <h2 id={titleId} className="text-xl font-semibold">Create Workspace</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor={nameId} className="block text-sm font-medium mb-2">Workspace Name *</label>
              <input
                id={nameId}
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Acme Corporation"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor={domainId} className="block text-sm font-medium mb-2">Domain *</label>
              <input
                id={domainId}
                type="text"
                value={formData.domain}
                onChange={(e) => setFormData((p) => ({ ...p, domain: e.target.value }))}
                placeholder="e.g., acme.com"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor={descriptionId} className="block text-sm font-medium mb-2">Description</label>
              <textarea
                id={descriptionId}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description..."
                rows={2}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <span id={productsLabelId} className="text-sm font-medium">Products & Technologies</span>
              <button
                type="button"
                onClick={() => setShowSuggestions((s) => !s)}
                className="text-xs text-primary hover:underline"
                aria-expanded={showSuggestions}
              >
                {showSuggestions ? "Hide suggestions" : "Show common products"}
              </button>
            </div>

            {showSuggestions && (
              <div className="mb-4 p-4 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground mb-3">Click to add:</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PRODUCTS.slice(0, 16).map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAddSuggested(p)}
                      disabled={products.some((x) => x.name === p.name)}
                      className={cn(
                        "px-3 py-1 text-xs bg-background/80 border border-border rounded-full",
                        "hover:bg-primary/20 hover:text-primary hover:border-primary/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {products.length > 0 && (
              <ul className="mb-4 space-y-2" aria-labelledby={productsLabelId}>
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                  >
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.vendor && (
                        <span className="text-muted-foreground text-sm ml-2">by {p.vendor}</span>
                      )}
                      <span className="ml-2 text-xs px-2 py-0.5 bg-background/80 rounded-full text-muted-foreground">
                        {p.category}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(p.id)}
                      className="text-destructive hover:bg-destructive/20 p-1 rounded"
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="p-4 bg-background rounded-lg border border-dashed border-border">
              <p className="text-xs text-muted-foreground mb-3">Add custom product:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={productNameId} className="sr-only">Product name</label>
                  <input
                    id={productNameId}
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Product name *"
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={productVendorId} className="sr-only">Product vendor</label>
                  <input
                    id={productVendorId}
                    type="text"
                    value={newProduct.vendor}
                    onChange={(e) => setNewProduct((p) => ({ ...p, vendor: e.target.value }))}
                    placeholder="Vendor"
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={productVersionId} className="sr-only">Product version</label>
                  <input
                    id={productVersionId}
                    type="text"
                    value={newProduct.version}
                    onChange={(e) => setNewProduct((p) => ({ ...p, version: e.target.value }))}
                    placeholder="Version (optional)"
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={productCategoryId} className="sr-only">Product category</label>
                  <Select value={newProduct.category} onValueChange={(v) => setNewProduct((p) => ({ ...p, category: v }))}>
                    <SelectTrigger id={productCategoryId} className="text-sm h-10 border-border bg-card">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={handleAddProduct}
                disabled={!newProduct.name.trim()}
              >
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name.trim() || !formData.domain.trim()}>
              Create Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
