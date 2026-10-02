import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProductosClient from './ProductosClient';
import type { ProductRecord } from './actions';

export default async function ProductosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'supervisor') {
    redirect('/dashboard');
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, active')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  return <ProductosClient initialProducts={(products ?? []) as ProductRecord[]} />;
}
