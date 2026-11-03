import { createFileRoute } from "@tanstack/react-router";
import { CloudyAppFrame } from "@/features/cloudy-app/CloudyAppFrame";

export const Route = createFileRoute("/")({ component: CloudyAppFrame });
