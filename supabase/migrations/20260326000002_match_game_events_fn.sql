create or replace function public.match_game_events(
  p_game_id  uuid,
  p_embedding vector(1536),
  p_top_k    int default 5
)
returns table (
  id          uuid,
  event_type  text,
  summary     text,
  metadata    jsonb,
  created_at  timestamptz,
  similarity  float
)
language sql stable
as $$
  select
    id,
    event_type,
    summary,
    metadata,
    created_at,
    1 - (embedding <=> p_embedding) as similarity
  from public.game_events
  where game_id = p_game_id
    and embedding is not null
  order by embedding <=> p_embedding
  limit p_top_k;
$$;
