import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("level/:id", "routes/level.tsx"),
] satisfies RouteConfig;
