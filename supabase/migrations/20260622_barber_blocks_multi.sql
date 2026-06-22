-- Permettre PLUSIEURS blocages par barbier par jour.
-- Ex: Stéphanie veut se bloquer de 9h à 10h ET de 14h à 15h le même jour.
-- L'ancienne contrainte UNIQUE(barber, date) limitait à UN seul blocage par jour.
-- Tout le reste du système (calcul de dispo, check de conflit à la réservation,
-- affichage BookingClient) gère déjà plusieurs plages — seule cette contrainte bloquait.
ALTER TABLE barber_blocks DROP CONSTRAINT IF EXISTS barber_blocks_barber_date_key;
