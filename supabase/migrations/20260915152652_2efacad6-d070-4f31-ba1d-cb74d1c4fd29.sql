REVOKE ALL ON FUNCTION public.bump_ai_usage(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(integer) TO service_role;