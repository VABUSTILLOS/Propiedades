-- 010: Semantic search — pgvector match function for embeddings-backed queries.
-- The `embedding` column and HNSW index already exist (001). This function is
-- the RPC the app calls for cosine-similarity search over active listings.

create or replace function public.match_properties(
  query_embedding vector(1536),
  match_count int default 24
) returns table (
  id uuid,
  similarity float
) language plpgsql security definer
set search_path = public
as $$
begin
  return query
  select p.id, 1 - (p.embedding <=> query_embedding) as similarity
  from public.properties p
  where p.status = 'active'
    and p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
end;
$$;

revoke all on function public.match_properties(vector(1536), int) from public;
grant execute on function public.match_properties(vector(1536), int) to authenticated;
grant execute on function public.match_properties(vector(1536), int) to anon;
