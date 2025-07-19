import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { PresentationManagement } from '@/components/admin/PresentationManagement';
import { ReportsView } from '@/components/admin/ReportsView';
import { Shield, BarChart3, FileText, Users, LogOut } from 'lucide-react';

export function AdminDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">ICTAS 2025 Management Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium">{currentUser.name}</p>
                <p className="text-sm text-muted-foreground flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Administrator
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="presentations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presentations" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Presentations
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reports & Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="presentations" className="space-y-6">
            <PresentationManagement />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}