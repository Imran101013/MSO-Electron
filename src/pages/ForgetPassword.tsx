import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail } from "lucide-react";

export default function ForgetPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-sm border-t-2 border-primary/70 shadow-lg">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-sm border-2 border-primary/50 bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Forgot Password?</CardTitle>
          <CardDescription>Contact your administrator to reset your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This is an offline desktop application. Password reset emails are not available. Please contact your MSO administrator to reset your password.
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full h-11 rounded-sm shadow-md">
            <Link to="/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
