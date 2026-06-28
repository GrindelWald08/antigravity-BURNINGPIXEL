-- Add role column to profiles if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END;
$$;

-- Create policies for admin managing profiles
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Modify handle_new_user to make yuanaditya94@gmail.com an admin automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := 'user';
BEGIN
  IF new.email = 'yuanaditya94@gmail.com' THEN
    v_role := 'admin';
  END IF;

  -- Insert into profiles
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name', v_role)
  ON CONFLICT (user_id) DO UPDATE 
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = v_role;

  -- Insert into user_roles if table exists and user is admin
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, v_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- Promote yuanaditya94@gmail.com if they are already registered
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'yuanaditya94@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Ensure they have a profile
    INSERT INTO public.profiles (user_id, email, role)
    VALUES (v_user_id, 'yuanaditya94@gmail.com', 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

    -- Ensure they have the admin role in user_roles
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
END;
$$;
