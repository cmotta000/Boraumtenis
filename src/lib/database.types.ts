// Tipos do banco (schema public) do projeto bora-um-tenis.
// Versão enxuta: só as tabelas/enums/funções do app.
// Regenerar completo: `npx supabase gen types typescript --project-id qtsjuaogsybnlmvpggpu`

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MatchStatus = 'aberta' | 'cheia' | 'jogada' | 'cancelada';
export type MatchTipo = 'simples' | 'duplas';
export type PlayerStatus = 'convidado' | 'confirmado' | 'recusado';
export type ResultStatus = 'pendente' | 'confirmado' | 'contestado';
export type MaoDominante = 'destro' | 'canhoto' | 'ambidestro';
export type GolpePreferido = 'forehand' | 'backhand' | 'saque' | 'voleio' | 'smash';

/** Um set do placar: games de quem venceu (`v`) contra quem perdeu (`p`). */
export type SetPlacar = { v: number; p: number };

/** Jogador resumido, como vem nos arrays do feed. */
export type LadoJogador = { id: string; nome: string; avatar: string | null };

/** Um post do feed: o resultado de uma partida ou uma publicação de fotos. */
export type PostTipo = 'resultado' | 'foto';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          avatar_url: string | null;
          bio: string | null;
          cidade: string | null;
          uf: string | null;
          location: unknown | null;
          skill_level: number | null;
          elo_rating: number;
          mao_dominante: MaoDominante | null;
          idade: number | null;
          altura_cm: number | null;
          anos_jogando: number | null;
          golpe_preferido: GolpePreferido | null;
          disponibilidade: Json;
          pontos: number;
          vitorias: number;
          derrotas: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          avatar_url?: string | null;
          bio?: string | null;
          cidade?: string | null;
          uf?: string | null;
          location?: unknown | null;
          skill_level?: number | null;
          elo_rating?: number;
          mao_dominante?: MaoDominante | null;
          idade?: number | null;
          altura_cm?: number | null;
          anos_jogando?: number | null;
          golpe_preferido?: GolpePreferido | null;
          disponibilidade?: Json;
          pontos?: number;
          vitorias?: number;
          derrotas?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          criador_id: string;
          tipo: MatchTipo;
          local_texto: string | null;
          location: unknown;
          data_hora: string;
          nivel_min: number | null;
          nivel_max: number | null;
          vagas_total: number;
          status: MatchStatus;
          observacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          criador_id: string;
          tipo?: MatchTipo;
          local_texto?: string | null;
          location: unknown;
          data_hora: string;
          nivel_min?: number | null;
          nivel_max?: number | null;
          vagas_total?: number;
          status?: MatchStatus;
          observacoes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
        Relationships: [];
      };
      match_players: {
        Row: { match_id: string; user_id: string; status: PlayerStatus; created_at: string };
        Insert: { match_id: string; user_id: string; status?: PlayerStatus; created_at?: string };
        Update: Partial<Database['public']['Tables']['match_players']['Insert']>;
        Relationships: [];
      };
      match_results: {
        Row: {
          id: string;
          match_id: string;
          reporter_id: string;
          vencedor_id: string | null;
          vencedores: string[];
          perdedores: string[];
          sets: SetPlacar[];
          sets_vencedor: number;
          sets_perdedor: number;
          pontos: number;
          legenda: string | null;
          fotos: string[];
          confirmado_por: string | null;
          confirmado_em: string | null;
          status: ResultStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          reporter_id: string;
          vencedor_id?: string | null;
          vencedores?: string[];
          perdedores?: string[];
          sets?: SetPlacar[];
          sets_vencedor?: number;
          sets_perdedor?: number;
          pontos?: number;
          legenda?: string | null;
          fotos?: string[];
          confirmado_por?: string | null;
          confirmado_em?: string | null;
          status?: ResultStatus;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_results']['Insert']>;
        Relationships: [];
      };
      result_likes: {
        Row: { result_id: string; user_id: string; created_at: string };
        Insert: { result_id: string; user_id: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['result_likes']['Insert']>;
        Relationships: [];
      };
      result_comments: {
        Row: { id: string; result_id: string; user_id: string; texto: string; created_at: string };
        Insert: { id?: string; result_id: string; user_id: string; texto: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['result_comments']['Insert']>;
        Relationships: [];
      };
      seasons: {
        Row: { id: string; nome: string; inicio: string; fim: string; ativa: boolean };
        Insert: { id?: string; nome: string; inicio: string; fim: string; ativa?: boolean };
        Update: Partial<Database['public']['Tables']['seasons']['Insert']>;
        Relationships: [];
      };
      rankings: {
        Row: {
          season_id: string;
          user_id: string;
          pontos: number;
          vitorias: number;
          derrotas: number;
          posicao: number | null;
        };
        Insert: {
          season_id: string;
          user_id: string;
          pontos?: number;
          vitorias?: number;
          derrotas?: number;
          posicao?: number | null;
        };
        Update: Partial<Database['public']['Tables']['rankings']['Insert']>;
        Relationships: [];
      };
      badges: {
        Row: { id: string; slug: string; nome: string; descricao: string | null; icone: string | null; regra: Json | null };
        Insert: { id?: string; slug: string; nome: string; descricao?: string | null; icone?: string | null; regra?: Json | null };
        Update: Partial<Database['public']['Tables']['badges']['Insert']>;
        Relationships: [];
      };
      user_badges: {
        Row: { user_id: string; badge_id: string; conquistado_em: string };
        Insert: { user_id: string; badge_id: string; conquistado_em?: string };
        Update: Partial<Database['public']['Tables']['user_badges']['Insert']>;
        Relationships: [];
      };
      push_tokens: {
        Row: { user_id: string; expo_token: string; plataforma: string | null; created_at: string };
        Insert: { user_id: string; expo_token: string; plataforma?: string | null; created_at?: string };
        Update: Partial<Database['public']['Tables']['push_tokens']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: { id: string; user_id: string; tipo: string; payload_json: Json; lida: boolean; created_at: string };
        Insert: { id?: string; user_id: string; tipo: string; payload_json?: Json; lida?: boolean; created_at?: string };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
      match_messages: {
        Row: { id: string; match_id: string; user_id: string; texto: string; created_at: string };
        Insert: { id?: string; match_id: string; user_id: string; texto: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['match_messages']['Insert']>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          tipo: PostTipo;
          result_id: string | null;
          match_id: string | null;
          legenda: string | null;
          fotos: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tipo?: PostTipo;
          result_id?: string | null;
          match_id?: string | null;
          legenda?: string | null;
          fotos?: string[];
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['posts']['Insert']>;
        Relationships: [];
      };
      post_likes: {
        Row: { post_id: string; user_id: string; created_at: string };
        Insert: { post_id: string; user_id: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['post_likes']['Insert']>;
        Relationships: [];
      };
      post_comments: {
        Row: { id: string; post_id: string; user_id: string; texto: string; created_at: string };
        Insert: { id?: string; post_id: string; user_id: string; texto: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['post_comments']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      definir_minha_localizacao: {
        Args: { lat: number; lng: number };
        Returns: undefined;
      };
      minha_localizacao: {
        Args: Record<string, never>;
        Returns: { lat: number; lng: number; cidade: string | null; uf: string | null }[];
      };
      partidas_proximas: {
        Args: { lat: number; lng: number; raio_m?: number; apenas_com_vaga?: boolean };
        Returns: {
          id: string;
          criador_id: string;
          criador_nome: string;
          tipo: MatchTipo;
          local_texto: string | null;
          data_hora: string;
          nivel_min: number | null;
          nivel_max: number | null;
          vagas_total: number;
          confirmados: number;
          status: MatchStatus;
          observacoes: string | null;
          distancia_m: number;
          meu_status: 'criador' | PlayerStatus | null;
        }[];
      };
      marcar_notificacoes_lidas: {
        Args: { p_ids?: string[] | null };
        Returns: undefined;
      };
      registrar_resultado: {
        Args: {
          p_match_id: string;
          p_vencedores: string[];
          p_sets: SetPlacar[];
          p_legenda?: string | null;
          p_fotos?: string[];
        };
        Returns: string;
      };
      confirmar_resultado: {
        Args: { p_result_id: string };
        Returns: undefined;
      };
      contestar_resultado: {
        Args: { p_result_id: string };
        Returns: undefined;
      };
      feed: {
        Args: { p_limite?: number; p_antes?: string | null; p_user_id?: string | null };
        Returns: {
          id: string;
          post_tipo: PostTipo;
          created_at: string;
          autor_id: string;
          autor_nome: string;
          autor_avatar: string | null;
          match_id: string | null;
          result_id: string | null;
          local_texto: string | null;
          data_hora: string | null;
          partida_tipo: MatchTipo | null;
          vencedores: LadoJogador[];
          perdedores: LadoJogador[];
          sets: SetPlacar[] | null;
          sets_vencedor: number | null;
          sets_perdedor: number | null;
          pontos: number | null;
          legenda: string | null;
          fotos: string[];
          curtidas: number;
          comentarios: number;
          eu_curti: boolean;
          posso_editar: boolean;
        }[];
      };
      curtir_post: {
        Args: { p_post_id: string; p_curtir?: boolean };
        Returns: undefined;
      };
      comentar_post: {
        Args: { p_post_id: string; p_texto: string };
        Returns: string;
      };
      comentarios_post: {
        Args: { p_post_id: string };
        Returns: {
          id: string;
          user_id: string;
          nome: string;
          avatar: string | null;
          texto: string;
          created_at: string;
        }[];
      };
      publicar_post: {
        Args: { p_legenda?: string | null; p_fotos?: string[]; p_match_id?: string | null };
        Returns: string;
      };
      adicionar_fotos_post: {
        Args: { p_post_id: string; p_fotos: string[] };
        Returns: string[];
      };
      remover_foto_post: {
        Args: { p_post_id: string; p_foto: string };
        Returns: string[];
      };
      excluir_post: {
        Args: { p_post_id: string };
        Returns: undefined;
      };
      ranking_temporada: {
        Args: { p_limite?: number };
        Returns: {
          user_id: string;
          nome: string;
          avatar: string | null;
          cidade: string | null;
          uf: string | null;
          pontos: number;
          vitorias: number;
          derrotas: number;
          posicao: number;
        }[];
      };
      temporada_nome: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      criar_partida: {
        Args: {
          p_local_texto: string | null;
          p_lat: number;
          p_lng: number;
          p_data_hora: string;
          p_tipo?: MatchTipo;
          p_nivel_min?: number | null;
          p_nivel_max?: number | null;
          p_vagas_total?: number;
          p_observacoes?: string | null;
        };
        Returns: string;
      };
      solicitar_entrada: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      responder_solicitacao: {
        Args: { p_match_id: string; p_user_id: string; p_aceitar: boolean };
        Returns: undefined;
      };
      sair_partida: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      cancelar_partida: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      match_status: MatchStatus;
      match_tipo: MatchTipo;
      player_status: PlayerStatus;
      result_status: ResultStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
