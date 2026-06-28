-- Create pricing_packages table to store all pricing data
CREATE TABLE public.pricing_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  period TEXT NOT NULL DEFAULT '/project',
  description TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_popular BOOLEAN NOT NULL DEFAULT false,
  discount_percentage NUMERIC DEFAULT 0,
  discount_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- Allow public read access for pricing display
CREATE POLICY "Anyone can view pricing packages" 
ON public.pricing_packages 
FOR SELECT 
USING (true);

-- Insert default pricing data
INSERT INTO public.pricing_packages (name, price, period, description, features, is_popular, sort_order) VALUES
('Basic', 1500000, '/project', 'Cocok untuk bisnis kecil yang baru mulai', ARRAY['1 Halaman', 'Desain Responsif', 'Hosting 1 Tahun', 'Domain .com', 'SSL Gratis', 'Revisi 2x'], false, 1),
('Professional', 3500000, '/project', 'Ideal untuk bisnis yang ingin berkembang', ARRAY['5 Halaman', 'Desain Premium', 'Hosting 1 Tahun', 'Domain .com', 'SSL Gratis', 'SEO Basic', 'Revisi 5x', 'WhatsApp Integration'], true, 2),
('Enterprise', 7500000, '/project', 'Solusi lengkap untuk bisnis besar', ARRAY['Unlimited Halaman', 'Desain Custom', 'Hosting 2 Tahun', 'Domain .com', 'SSL Gratis', 'SEO Advanced', 'Revisi Unlimited', 'Admin Dashboard', 'Maintenance 6 Bulan'], false, 3);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pricing_packages_updated_at
BEFORE UPDATE ON public.pricing_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();