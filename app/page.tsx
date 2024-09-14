import { Metadata } from "next";
import { HomePage } from "./HomePage";

export const metadata: Metadata = {
  title: "Playground",
  description: "The OpenAI Playground built using the components.",
};

export default function HomePageWithMetadata() {
  return (
    <HomePage />
  );
}
