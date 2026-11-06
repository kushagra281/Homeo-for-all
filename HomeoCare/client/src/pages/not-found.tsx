import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            This page does not exist. The link may be old or mistyped.
          </p>
          <Link href="/" data-testid="not-found-home"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2">
            Go to home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
