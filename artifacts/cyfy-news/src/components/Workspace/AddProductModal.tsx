import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addProduct as apiAddProduct } from "@workspace/api-client-react";

const PRODUCT_CATEGORIES = [
  "Operating System",
  "Web Server",
  "Database",
  "Email Server",
  "Firewall",
  "VPN",
  "Cloud Platform",
  "Container Platform",
  "CI/CD",
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
  { name: "AWS", vendor: "Amazon", category: "Cloud Platform" },
  { name: "Azure", vendor: "Microsoft", category: "Cloud Platform" },
  { name: "Kubernetes", vendor: "CNCF", category: "Container Platform" },
  { name: "Docker", vendor: "Docker", category: "Container Platform" },
];

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onAdded: () => void;
}

export function AddProductModal({ isOpen, onClose, workspaceId, onAdded }: AddProductModalProps) {
  const [product, setProduct] = useState({
    name: "",
    vendor: "",
    version: "",
    category: "Other",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiAddProduct(workspaceId, {
        name: product.name.trim(),
        vendor: product.vendor.trim() || undefined,
        version: product.version.trim() || undefined,
        category: product.category,
      });
      setProduct({ name: "", vendor: "", version: "", category: "Other" });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSuggested = async (p: (typeof COMMON_PRODUCTS)[0]) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiAddProduct(workspaceId, {
        name: p.name,
        vendor: p.vendor,
        category: p.category,
      });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add Product</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm bg-destructive/20 text-destructive rounded-lg">{error}</div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">Quick add:</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_PRODUCTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAddSuggested(p)}
                  disabled={submitting}
                  className="px-3 py-1 text-xs bg-background border border-border rounded-full hover:bg-primary/20 hover:text-primary hover:border-primary/50 disabled:opacity-50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">Or add custom:</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={product.name}
                onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))}
                placeholder="Product name *"
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary outline-none"
                required
              />
              <input
                type="text"
                value={product.vendor}
                onChange={(e) => setProduct((p) => ({ ...p, vendor: e.target.value }))}
                placeholder="Vendor"
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary outline-none"
              />
              <input
                type="text"
                value={product.version}
                onChange={(e) => setProduct((p) => ({ ...p, version: e.target.value }))}
                placeholder="Version (optional)"
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-primary outline-none"
              />
              <Select value={product.category} onValueChange={(v) => setProduct((p) => ({ ...p, category: v }))}>
                <SelectTrigger className="text-sm h-10 border-border bg-background">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              disabled={!product.name.trim() || submitting}
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
