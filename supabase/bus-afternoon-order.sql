-- Applied 19 Nov 2026. Separate afternoon drop-off order (Myri): no longer just the morning in reverse.
-- bus_riders.afternoon_order (1 = first drop-off). bus_run_list returns it and sorts the afternoon list by it
-- (fallback: morning route_order reversed). src/BusRun.jsx sorts the same way.
-- Afternoon order set: Madeem, Mila, Kai, Mamitchi, Jeavis, Francesco, Jayden, Enola, Sarah, Aria, Mikael, Mia, Eythan, Bloom.
alter table public.bus_riders add column if not exists afternoon_order integer;
