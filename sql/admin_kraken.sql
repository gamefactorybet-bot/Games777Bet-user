-- Usuario del estudio de Kraken.
-- Corré esto en el SQL Editor del Supabase de Kraken, una vez.
-- Antes de ejecutar, cambiá la clave de la línea de crypt(...).
--
-- Esta base no trae usuarios de Win777. El otro proyecto tiene
-- los suyos y no se copian. El estudio deja pasar a cualquiera
-- que tenga sesión, así que este correo es el admin.

create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'kraken@gmail.com';
  v_id uuid;
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt('CAMBIAR-ESTA-CLAVE', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"nombre":"Kraken"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email',
      v_id::text,
      now(),
      now(),
      now()
    );
  end if;
end $$;
