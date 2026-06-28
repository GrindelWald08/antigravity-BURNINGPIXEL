-- Create storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true);

-- Create portfolio_items table
CREATE TABLE public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view portfolio items" 
ON public.portfolio_items 
FOR SELECT 
USING (is_visible = true);

-- Allow all operations (admin via password protection)
CREATE POLICY "Allow all operations for portfolio items"
ON public.portfolio_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Storage policies for portfolio bucket
CREATE POLICY "Anyone can view portfolio images"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio');

CREATE POLICY "Allow upload to portfolio bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio');

CREATE POLICY "Allow update portfolio images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio');

CREATE POLICY "Allow delete portfolio images"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio');

-- Insert default portfolio data
INSERT INTO public.portfolio_items (title, category, description, image_url, link_url, sort_order) VALUES
('Tech Startup Website', 'Landing Page', 'Modern landing page for a tech startup', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop', NULL, 1),
('Fashion E-Commerce', 'Toko Online', 'Full-featured online store for fashion brand', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop', NULL, 2),
('Corporate Company', 'Company Profile', 'Professional company profile website', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop', NULL, 3),
('Restaurant Website', 'Landing Page', 'Elegant restaurant website with menu', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop', NULL, 4),
('Real Estate Platform', 'Toko Online', 'Property listing platform', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop', NULL, 5),
('Digital Agency', 'Company Profile', 'Creative agency portfolio website', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop', NULL, 6);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();