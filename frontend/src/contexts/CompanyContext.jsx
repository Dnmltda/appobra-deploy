import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';

const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
  const [currentCompany, setCurrentCompanyState] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const setCurrentCompany = (company) => {
    setCurrentCompanyState(company);
    if (company) {
      localStorage.setItem('currentCompanyId', company.id);
    } else {
      localStorage.removeItem('currentCompanyId');
    }
  };

  const refreshCompanyList = async () => {
    setLoading(true);
    try {
      if (!pb.authStore.model || !pb.authStore.model.company_id) {
        setCompanies([]);
        setCurrentCompany(null);
        setLoading(false);
        return;
      }

      const records = await pb.collection('companies').getFullList({
        filter: `id="${pb.authStore.model.company_id}"`,
        $autoCancel: false 
      });
      setCompanies(records);

      if (records.length > 0) {
        setCurrentCompany(records[0]);
      } else {
        setCurrentCompany(null);
      }
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pb.authStore.isValid) {
      refreshCompanyList();
    } else {
      setLoading(false);
    }

    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) {
        refreshCompanyList();
      } else {
        setCompanies([]);
        setCurrentCompany(null);
      }
    });

    return () => unsub();
  }, []);

  return (
    <CompanyContext.Provider value={{ 
      currentCompany, 
      companies, 
      setCurrentCompany,
      refreshCompanyList,
      loading 
    }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany deve ser usado dentro de um CompanyProvider');
  }
  return context;
};