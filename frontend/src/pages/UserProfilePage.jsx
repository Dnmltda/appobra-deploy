import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Calendar, Shield, Camera, Edit, Lock } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import PasswordRecoveryModal from '@/components/PasswordRecoveryModal.jsx';
import pb from '@/lib/pocketbaseClient';

const UserProfilePage = () => {
  const { currentUser, updateProfile, uploadProfilePhoto } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    telefone: currentUser?.telefone || '',
    email: currentUser?.email || ''
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile(formData);
      toast.success('Perfil atualizado com sucesso');
      setIsEditing(false);
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB');
      return;
    }
    
    setLoading(true);
    try {
      await uploadProfilePhoto(file);
      toast.success('Foto atualizada com sucesso');
    } catch (error) {
      toast.error('Erro ao atualizar foto');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ativo': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'Inativo': return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
      case 'Bloqueado': return 'bg-red-500/10 text-red-700 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const getCargoColor = (cargo) => {
    switch (cargo) {
      case 'Administrador': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'Engenheiro': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'Mestre de Obras': return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'Almoxarife': return 'bg-teal-500/10 text-teal-700 border-teal-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const photoUrl = currentUser?.foto ? pb.files.getURL(currentUser, currentUser.foto) : null;

  return (
    <>
      <Helmet><title>Meu Perfil - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-primary">Meu Perfil</h1>
            <p className="text-muted-foreground">Gerencie suas informações pessoais e configurações</p>
          </div>

          <div className="grid gap-6">
            {/* Profile Header Card */}
            <Card className="shadow-sm border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <div className="relative">
                    <Avatar className="w-32 h-32 border-4 border-primary/10">
                      <AvatarImage src={photoUrl} alt={currentUser?.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                        {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor="photo-upload" className="absolute bottom-0 right-0 p-2 bg-accent text-accent-foreground rounded-full cursor-pointer hover:bg-accent/90 transition-all shadow-lg">
                      <Camera className="w-4 h-4" />
                      <input 
                        id="photo-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handlePhotoUpload}
                        disabled={loading}
                      />
                    </label>
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl font-bold text-primary mb-2">{currentUser?.name || 'Usuário'}</h2>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                      <Badge className={`${getCargoColor(currentUser?.cargo)} font-semibold`}>
                        {currentUser?.cargo || 'Sem cargo'}
                      </Badge>
                      <Badge className={`${getStatusColor(currentUser?.status)} font-semibold`}>
                        {currentUser?.status || 'Ativo'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <Shield className="w-4 h-4" />
                        <span className="font-medium">ID: {currentUser?.id_unico || currentUser?.id}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <Calendar className="w-4 h-4" />
                        <span>Cadastrado em {new Date(currentUser?.data_cadastro || currentUser?.created).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {!isEditing ? (
                      <>
                        <Button onClick={() => setIsEditing(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold">
                          <Edit className="w-4 h-4 mr-2" /> Editar Perfil
                        </Button>
                        <Button variant="outline" onClick={() => setShowPasswordModal(true)}>
                          <Lock className="w-4 h-4 mr-2" /> Alterar Senha
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={handleSave} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold">
                          {loading ? 'Salvando...' : 'Salvar'}
                        </Button>
                        <Button variant="outline" onClick={() => { setIsEditing(false); setFormData({ name: currentUser?.name || '', telefone: currentUser?.telefone || '', email: currentUser?.email || '' }); }}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Details Card */}
            <Card className="shadow-sm border-border bg-card">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xl text-primary flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informações Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-bold text-foreground flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Nome Completo
                    </Label>
                    {isEditing ? (
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-background"
                      />
                    ) : (
                      <p className="text-foreground py-2">{currentUser?.name || '-'}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-bold text-foreground flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email
                    </Label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-background"
                      />
                    ) : (
                      <p className="text-foreground py-2">{currentUser?.email || '-'}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-bold text-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Telefone
                    </Label>
                    {isEditing ? (
                      <Input
                        type="tel"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        className="bg-background"
                      />
                    ) : (
                      <p className="text-foreground py-2">{currentUser?.telefone || '-'}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="font-bold text-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      Nome de Usuário
                    </Label>
                    <p className="text-foreground py-2">{currentUser?.username || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <PasswordRecoveryModal 
        open={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)}
        mode="change"
      />
    </>
  );
};

export default UserProfilePage;