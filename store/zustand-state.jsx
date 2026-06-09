import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// FORM STORE (sin cambios)
// ─────────────────────────────────────────────

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
  tieneZona: false, zonaDesc: "",
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

// ─────────────────────────────────────────────
// CAMPOS QUE CONFORMAN UNA PLANTILLA DE PREDIO
// (Datos del propietario → Acceso vehicular)
// ─────────────────────────────────────────────

const CAMPOS_TEMPLATE = [
  'nombre', 'cedula', 'direccion', 'telefono', 'propCorreo',
  'tieneZona', 'zonaDesc',
  'interNombre', 'interCargo', 'interCorreo',
  'longitudFrenteYFondo', 'numeroPisos', 'estrato', 'anioConstruccion', 'estaOcupada',
  'servicioAgua', 'servicioAlcantarillado', 'servicioEnergia',
  'servicioTelefono', 'servicioGas', 'servicioOtros',
  'usoResidencial', 'usoComercial', 'usoIndustrial', 'usoInstitucional',
  'usoRecreacional', 'usoBaldio', 'usoBIC', 'usoMixto', 'usoOtro',
  'tieneGaraje', 'cantidadGarajes', 'usoGaraje',
  'usoGarajeComercial', 'usoGarajeResidencial', 'anchoAccesoVehicular',
  'latitud', 'longitud',
];

// ─────────────────────────────────────────────
// STORE DE PLANTILLAS DE PREDIO
// ─────────────────────────────────────────────

export const usePredioTemplates = create(
  persist(
    (set, get) => ({
      templates: [],

      // Crea una plantilla a partir del formData actual
      // Solo extrae los campos relevantes (CAMPOS_TEMPLATE)
      crearDesdeForm: (nombreTemplate, formData) => {
        const datos = {};
        CAMPOS_TEMPLATE.forEach(k => { datos[k] = formData[k]; });

        const nueva = {
          id:       `tmpl_${Date.now()}`,
          nombre:   nombreTemplate,
          creadoEn: new Date().toISOString(),
          datos,
        };
        set(s => ({ templates: [...s.templates, nueva] }));
        return nueva;
      },

      actualizarTemplate: (id, nombreTemplate, formData) => {
        const datos = {};
        CAMPOS_TEMPLATE.forEach(k => { datos[k] = formData[k]; });
        set(s => ({
          templates: s.templates.map(t =>
            t.id === id ? { ...t, nombre: nombreTemplate, datos } : t
          ),
        }));
      },

      eliminarTemplate: (id) => {
        set(s => ({ templates: s.templates.filter(t => t.id !== id) }));
      },

      // Devuelve un objeto listo para pasarle a setField en el form
      // Solo los campos de la plantilla, el resto del form queda intacto
      getFieldsParaForm: (id) => {
        const tmpl = get().templates.find(t => t.id === id);
        return tmpl ? tmpl.datos : null;
      },
    }),
    {
      name:    'predio-templates',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─────────────────────────────────────────────
// STORE DE BORRADORES
// ─────────────────────────────────────────────

export const useBorradores = create(
  persist(
    (set, get) => ({
      borradores: [],

      // Guarda o actualiza un borrador
      // Si se pasa idExistente, actualiza; si no, crea uno nuevo
      guardarBorrador: (nombre, formData, templateId = null, idExistente = null) => {
        const ahora = new Date().toISOString();

        if (idExistente) {
          const existe = get().borradores.find(b => b.id === idExistente);
          if (existe) {
            const actualizado = { ...existe, nombre, formData, actualizadoEn: ahora };
            set(s => ({
              borradores: s.borradores.map(b => b.id === idExistente ? actualizado : b),
            }));
            return actualizado;
          }
        }

        const nuevo = {
          id:            `borrador_${Date.now()}`,
          nombre,
          templateId,
          creadoEn:      ahora,
          actualizadoEn: ahora,
          estado:        'borrador', // 'borrador' | 'en_cola' | 'subido'
          formData,
        };
        set(s => ({ borradores: [nuevo, ...s.borradores] }));
        return nuevo;
      },

      eliminarBorrador: (id) => {
        set(s => ({ borradores: s.borradores.filter(b => b.id !== id) }));
      },

      marcarEnCola: (id) => {
        set(s => ({
          borradores: s.borradores.map(b =>
            b.id === id ? { ...b, estado: 'en_cola' } : b
          ),
        }));
      },

      marcarSubido: (id) => {
        set(s => ({
          borradores: s.borradores.map(b =>
            b.id === id ? { ...b, estado: 'subido' } : b
          ),
        }));
      },

      // Atajos para la UI
      pendientesDeSubir: () => get().borradores.filter(b => b.estado === 'borrador'),
      enCola:            () => get().borradores.filter(b => b.estado === 'en_cola'),
      totalActivos:      () => get().borradores.filter(b => b.estado !== 'subido').length,
    }),
    {
      name:    'borradores-actas',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);