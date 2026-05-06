import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialFormData = {
  tipoActa: "",
  nombre: "", cedula: "", direccion: "", telefono: "", propCorreo: "",
  interCorreo: "", interNombre: "", interCargo: "",
  firmaConcesionario: { nombre: "", cedula: "", cargo: "", firma: null },
  firmaProfesional:   { nombre: "", cedula: "", cargo: "", firma: null },
  firmaPropietarioPredio: { nombre: "", correo: "", celular: "", firma: null },
  latitud: null, longitud: null,
  longitudFrenteYFondo: "", numeroPisos: "", estrato: "", anioConstruccion: "",
  estaOcupada: false,
  servicioAgua: "", servicioAlcantarillado: "", servicioEnergia: "",
  servicioTelefono: "", servicioGas: "", servicioOtros: "",
  usoResidencial: "", usoComercial: "", usoIndustrial: "", usoInstitucional: "",
  usoRecreacional: "", usoBaldio: "", usoBIC: "", usoMixto: "", usoOtro: "",
  tieneGaraje: false, cantidadGarajes: "", usoGaraje: "",
  usoGarajeComercial: "", usoGarajeResidencial: "", anchoAccesoVehicular: "",
  fisurasCerradas: false, fisurasCerradasDesc: "",
  fisurasAbiertas: false, fisurasAbiertasDesc: "",
  grietas: false, grietasDesc: "",
  tieneZona: false,
  zonaDesc:  "",
  acabadosPisos: "", estadoFachada: "",
  verticalidad: false, verticalidadNotas: "",
  planTopografico: false, observacionesProfesional: "",
  fotos: [], fotosFachada: [], videos: [],
};

export const useFormStore = create(
  persist(
    (set) => ({
      formData: initialFormData,
      setField: (field, value) => set(state => ({
        formData: { ...state.formData, [field]: value }
      })),
      clearForm: () => set({ formData: initialFormData }),
    }),
    {
      name: 'form-draft',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);