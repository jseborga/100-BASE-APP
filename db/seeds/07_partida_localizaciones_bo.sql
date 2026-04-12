-- Seed file: Partida Localizaciones Bolivia (NB Codes)
-- Maps all 111 partidas to their local NB (Norma Boliviana) codes
-- Executed after seeds 01-06

INSERT INTO partida_localizaciones (id, partida_id, estandar_id, codigo_local, referencia_norma) VALUES

-- Chapter 01: Obras Preliminares (NB-OPR)
(gen_random_uuid(), 'fc2a6339-c113-402f-bac3-fba63c5cd3a6', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '01.01', 'NB 1225000 - Cerco perimetral'),
(gen_random_uuid(), '1cb1e1d9-09ad-4938-8bc0-b19c4f0e0aa9', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '01.02', 'NB 1225000 - Demoliciones'),
(gen_random_uuid(), 'acb7e34c-6ed3-4094-aa00-3b7cd320961b', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '01.03', 'NB 1225000 - Instalación de faenas'),
(gen_random_uuid(), 'ba3fdb89-e4b9-4bde-a4b3-a3e2bcaf7723', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '01.04', 'NB 1225000 - Letrero de obra'),
(gen_random_uuid(), 'f6b66bfc-14f4-4f2d-9f3c-a91a1368cedc', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '01.05', 'NB 1225000 - Limpieza del terreno'),
(gen_random_uuid(), '11986939-3f8c-4d74-aa06-69aa67372bfa', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '01.06', 'NB 1225000 - Replanteo y trazado'),
(gen_random_uuid(), 'df9fab2a-05e7-46e7-9364-47bfc6ff38a3', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '01.07', 'NB 1225000 - Retiro de escombros'),

-- Chapter 02: Movimiento de Tierras (NB-MVT)
(gen_random_uuid(), '7ac9733d-3aa8-4615-a5bc-d71a92c69f5c', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '02.01', 'NB 1225000 - Excavación manual 0-2m'),
(gen_random_uuid(), 'fcfaf125-faed-4ee3-ba48-038fde864784', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '02.02', 'NB 1225000 - Excavación mecánica'),
(gen_random_uuid(), 'ace59a4e-c34b-4dd6-9c97-826299f30548', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '02.03', 'NB 1225000 - Nivelación y compactado'),
(gen_random_uuid(), '51489740-c9ac-486b-8648-f8beb81495ec', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '02.04', 'NB 1225000 - Relleno compactado'),
(gen_random_uuid(), '45bc7672-051c-4727-af71-66b9058d85eb', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '02.05', 'NB 1225000 - Relleno con material de préstamo'),
(gen_random_uuid(), 'c594644e-fefd-49cd-a5a3-9b42371ac555', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '02.06', 'NB 1225000 - Retiro de material excedente'),

-- Chapter 03: Fundaciones (NB-FUN)
(gen_random_uuid(), '818156fc-5622-423e-94b8-3521ca77c8e4', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.01', 'NB 1225001 - Cimiento de HºCº'),
(gen_random_uuid(), '06546589-b90f-4234-8ddd-d65268a821a6', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.02', 'NB 1225001 - Drenaje de fundaciones'),
(gen_random_uuid(), 'cdf9bce7-eade-4d81-a41c-028a58eadb52', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.03', 'NB 1225001 - Hormigón pobre de nivelación'),
(gen_random_uuid(), 'a2819c26-20d7-414d-82a6-3df8ab2f08cd', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.04', 'NB 1225001 - Impermeabilización de fundaciones'),
(gen_random_uuid(), '67bad6f4-8c6c-4e28-a695-15f9ccfe9ba5', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.05', 'NB 1225001 - Muro de contención HºAº'),
(gen_random_uuid(), '3d4a46d3-7561-4f1d-a414-cf192f256640', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.06', 'NB 1225001 - Sobrecimiento de HºCº'),
(gen_random_uuid(), 'e733e0e3-3415-4b8f-b390-dc1bdabb2d83', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.07', 'NB 1225001 - Vigas de fundación'),
(gen_random_uuid(), '98d6110a-a757-4af2-958b-da8d8a80d985', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '03.08', 'NB 1225001 - Zapatas de HºAº'),

-- Chapter 04: Estructura de Hormigón Armado (NB-EHA)
(gen_random_uuid(), 'f9bd8d96-b2ae-4478-be0f-8aaf50d6a65e', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.01', 'NB 1225001 - Acero de refuerzo'),
(gen_random_uuid(), '4f14eaa4-90c6-4214-8e9c-75c8739f0fcc', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.02', 'NB 1225001 - Columnas de HºAº'),
(gen_random_uuid(), '2817e528-8ef1-4512-8189-ff1ca1571625', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.03', 'NB 1225001 - Curado de hormigón'),
(gen_random_uuid(), 'e6b9bff2-fe30-41c2-9a0b-6e9053aee098', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.04', 'NB 1225001 - Encofrado de columnas'),
(gen_random_uuid(), '541b62b3-ca7d-4034-93fc-049c89a25583', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.05', 'NB 1225001 - Encofrado de losas'),
(gen_random_uuid(), '2660e915-7411-45d6-af33-68befdb7c234', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.06', 'NB 1225001 - Encofrado de vigas'),
(gen_random_uuid(), 'd3fdaa59-a320-4da9-99e2-2134c98185be', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.07', 'NB 1225001 - Escaleras de HºAº'),
(gen_random_uuid(), 'df43910f-ccdc-4f06-aa5e-93274922caf8', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.08', 'NB 1225001 - Losa alivianada'),
(gen_random_uuid(), '8ba5bfbc-675b-4159-b83b-bbf42697451a', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.09', 'NB 1225001 - Losa maciza'),
(gen_random_uuid(), 'd5c51b1a-04eb-4738-b70c-98f3e9da19ae', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '04.10', 'NB 1225001 - Vigas de HºAº'),

-- Chapter 05: Estructura Metálica (NB-EMT)
(gen_random_uuid(), '0ce55ac8-f34f-4b90-b7c8-b631928202d5', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '05.01', 'NB 1225000 - Cerchas metálicas'),
(gen_random_uuid(), 'fdf48160-89fa-491f-b347-d9a8b89b90d0', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '05.02', 'NB 1225000 - Correas metálicas'),
(gen_random_uuid(), '6b783bb4-bcac-4386-b144-e54e8698da40', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '05.03', 'NB 1225000 - Estructura metálica para cubierta'),
(gen_random_uuid(), '23099e62-b528-4070-a96e-54eb3590c73e', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '05.04', 'NB 1225000 - Pintura anticorrosiva estructura'),

-- Chapter 06: Muros y Tabiques (NB-MUR)
(gen_random_uuid(), '49c98f10-8808-4236-ba65-fe411e1dc09f', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '06.01', 'NB 1225002 - Dintel de HºAº'),
(gen_random_uuid(), 'bf5386fc-68f5-4b79-b769-4f900c93b05d', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '06.02', 'NB 1225002 - Junta de dilatación muros'),
(gen_random_uuid(), 'c32a13e0-7801-4bb8-953d-7b37d724d35e', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '06.03', 'NB 1225002 - Malla de refuerzo para muros'),
(gen_random_uuid(), 'f08bc6e4-7c9d-42ac-8793-18aa5e2b52cd', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '06.04', 'NB 1225002 - Muro de ladrillo 6 huecos e=12cm'),
(gen_random_uuid(), '9b9e1e51-2f05-4647-8329-bb74a597cee2', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '06.05', 'NB 1225002 - Muro de ladrillo 6 huecos e=18cm'),
(gen_random_uuid(), 'afe27b73-4c11-4a79-ab03-a3e405efa06f', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '06.06', 'NB 1225002 - Muro de ladrillo gambote'),
(gen_random_uuid(), '18e8bbae-3f33-4d7e-904b-be808b281064', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '06.07', 'NB 1225002 - Tabique de drywall'),

-- Chapter 07: Revoques y Enlucidos (NB-REV)
(gen_random_uuid(), '53d66e93-5180-427e-9129-d3856406e98d', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '07.01', 'NB 1225000 - Bruñas'),
(gen_random_uuid(), 'bf7087a8-6495-439b-bbe5-61e0f79ec72c', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '07.02', 'NB 1225000 - Enlucido de yeso en cielo raso'),
(gen_random_uuid(), 'c3bd88d9-b3d3-4bcb-9bca-63c627ab7ff7', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '07.03', 'NB 1225000 - Fajas de nivel'),
(gen_random_uuid(), '71d67fcc-3712-4383-8ae4-76324151808b', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '07.04', 'NB 1225000 - Revoque de cemento en columnas'),
(gen_random_uuid(), 'af0f9855-6183-4f84-bb7d-6871b4b867b8', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '07.05', 'NB 1225000 - Revoque de cemento en vigas'),
(gen_random_uuid(), '35703195-0ae9-4a3f-9f73-9f11a06b66dc', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '07.06', 'NB 1225000 - Revoque exterior de cemento'),
(gen_random_uuid(), '66a291d7-7911-45df-a94c-714c97eee4f4', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '07.07', 'NB 1225000 - Revoque interior de yeso'),

-- Chapter 08: Pisos y Pavimentos (NB-PIS)
(gen_random_uuid(), '4e0fe119-4bdc-4a37-85e0-c9150f07a433', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.01', 'NB 1225000 - Carpeta de nivelación'),
(gen_random_uuid(), '25484f50-b3c6-4708-b5be-cc19cef7c4df', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.02', 'NB 1225000 - Contrapiso de hormigón'),
(gen_random_uuid(), '86c0c570-5be2-476c-ab1b-e6a4d77c2e39', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.03', 'NB 1225000 - Impermeabilización de pisos'),
(gen_random_uuid(), '9c71f4b8-fdbd-4eb3-ba80-a8db0c3d0dd7', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.04', 'NB 1225000 - Junta de dilatación pisos'),
(gen_random_uuid(), '12555f6a-7c3f-4680-a106-d50c98234d71', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.05', 'NB 1225000 - Piso cerámico'),
(gen_random_uuid(), '5c20e9f4-f6ba-40ae-995e-35e492513102', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.06', 'NB 1225000 - Piso de cemento pulido'),
(gen_random_uuid(), '781bec6a-46fe-49b6-aebe-c4c10b88e2b3', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.07', 'NB 1225000 - Piso porcelanato'),
(gen_random_uuid(), 'f1bbe530-a9d6-4c32-b8b5-5234b2b5ef15', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '08.08', 'NB 1225000 - Zócalo cerámico'),

-- Chapter 09: Cubiertas (NB-CUB)
(gen_random_uuid(), 'cf25e6c8-3e5b-4bce-a8ee-519927dd0c25', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '09.01', 'NB 1225000 - Botaguas'),
(gen_random_uuid(), '754c4a67-30d8-4ea5-b52a-0a3cdf4e1236', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '09.02', 'NB 1225000 - Cubierta de calamina galvanizada'),
(gen_random_uuid(), '87ccb235-6e2c-4cde-92c8-50c9f291a8a7', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '09.03', 'NB 1225000 - Cubierta de teja colonial'),
(gen_random_uuid(), '20f95f3c-600c-4bae-8d9b-7b6a04c92943', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '09.04', 'NB 1225000 - Cumbrera'),
(gen_random_uuid(), 'cc4bcf9a-328c-4142-a21b-03e27f65375d', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '09.05', 'NB 1225000 - Impermeabilización de cubierta'),
(gen_random_uuid(), '6b0385e4-0b09-4b9d-b62c-f964a8f2fe11', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '09.06', 'NB 1225000 - Limahoyas'),

-- Chapter 10: Carpintería de Madera (NB-CMA)
(gen_random_uuid(), '6caf6968-619d-4680-acf0-516ab31485cd', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '10.01', 'NB 1225000 - Closet empotrado'),
(gen_random_uuid(), 'efdf2a6f-9da5-4d67-b0d3-79ad9d071545', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '10.02', 'NB 1225000 - Marco de madera'),
(gen_random_uuid(), '0433a29b-d502-4f9d-b5a4-c5ce84dd6ee5', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '10.03', 'NB 1225000 - Mueble de cocina alto'),
(gen_random_uuid(), '3b99a078-64ea-4c79-922b-e32b623ff83c', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '10.04', 'NB 1225000 - Mueble de cocina bajo'),
(gen_random_uuid(), '6535279a-c63e-42eb-912a-09fb529557d8', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '10.05', 'NB 1225000 - Puerta de closet'),
(gen_random_uuid(), '862a8bc9-308a-4bcc-b1b6-6d3cc2a0a2fc', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '10.06', 'NB 1225000 - Puerta interior madera'),
(gen_random_uuid(), '2fb2a673-834c-437e-8c5d-eeafc602ec78', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '10.07', 'NB 1225000 - Puerta principal madera'),

-- Chapter 11: Carpintería Metálica (NB-CME)
(gen_random_uuid(), '5ed4672a-98bd-440c-977f-d4ef71335981', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '11.01', 'NB 1225000 - Baranda metálica'),
(gen_random_uuid(), 'e00bc924-897b-4827-af7e-865bd467374d', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '11.02', 'NB 1225000 - Escalera metálica tipo gato'),
(gen_random_uuid(), '57bcd4f0-3ef6-4f2b-88ea-13a5f5fe09c8', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '11.03', 'NB 1225000 - Pasamanos metálico'),
(gen_random_uuid(), '9d495484-4bad-4e9e-b45d-a2078ad6db7a', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '11.04', 'NB 1225000 - Puerta metálica'),
(gen_random_uuid(), '9c7e7dff-a4f3-4a6f-8370-8c50ee524c6a', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '11.05', 'NB 1225000 - Reja de seguridad'),
(gen_random_uuid(), '68d5b2e4-9d97-4a63-9856-3327e234490a', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '11.06', 'NB 1225000 - Ventana de aluminio'),

-- Chapter 12: Pintura (NB-PIN)
(gen_random_uuid(), '9c6ff68b-fb78-4fc8-8db6-e934cf9df7bb', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '12.01', 'NB 1225000 - Pintura al óleo en puertas'),
(gen_random_uuid(), 'a480378f-b0e0-427c-b6ea-38290112e830', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '12.02', 'NB 1225000 - Pintura anticorrosiva'),
(gen_random_uuid(), '0f862347-2f1f-4507-a43d-41d0546a8343', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '12.03', 'NB 1225000 - Pintura látex exterior 2 manos'),
(gen_random_uuid(), '5070f9b9-91fd-4890-98b1-f523876c466f', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '12.04', 'NB 1225000 - Pintura látex interior 2 manos'),
(gen_random_uuid(), '01eb638d-321f-4a37-a09b-0f710f1ae087', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '12.05', 'NB 1225000 - Sellador para muros'),

-- Chapter 13: Vidrios y Cristales (NB-VID)
(gen_random_uuid(), '5894fb96-b84a-4ce0-8690-9a1c3e0f349d', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '13.01', 'NB 1225000 - Espejo 4mm'),
(gen_random_uuid(), 'e24c9d01-c406-4edf-8107-b5f1a43c3734', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '13.02', 'NB 1225000 - Vidrio laminado'),
(gen_random_uuid(), '4439a584-5c57-43ef-afb6-e1a6028a130d', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '13.03', 'NB 1225000 - Vidrio templado 6mm'),

-- Chapter 14: Instalaciones Sanitarias (NB-ISA)
(gen_random_uuid(), '0f8352c1-1e09-4c47-a02e-da412b32dd86', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.01', 'NB 688 - Bomba de agua'),
(gen_random_uuid(), 'acc79ed4-f6dd-48ee-b4d0-ca6c5b147831', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.02', 'NB 689 - Calefón a gas'),
(gen_random_uuid(), '55b23349-3328-481a-a0cf-a2049eee96d7', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.03', 'NB 688 - Cámara de inspección'),
(gen_random_uuid(), '8973f47b-bc7a-4a73-9c0b-c4134af9841e', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.04', 'NB 689 - Ducha con grifería'),
(gen_random_uuid(), '31610e09-f5c8-4751-9f2b-6ac116b26fb6', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.05', 'NB 689 - Inodoro tanque bajo'),
(gen_random_uuid(), 'd9b20005-efe3-4dad-af72-857ccc6c7011', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.06', 'NB 689 - Lavamanos pedestal'),
(gen_random_uuid(), 'eba18f66-f943-4e59-ba1f-293293ee6225', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.07', 'NB 689 - Lavaplatos acero inoxidable'),
(gen_random_uuid(), '555fad17-40e8-40f4-bcdd-956be059b1f0', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.08', 'NB 688 - Provisión e instalación tubería desagüe 2"'),
(gen_random_uuid(), '4d1a0e21-7020-42d0-9cf5-a08366d6c9e6', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.09', 'NB 688 - Provisión e instalación tubería desagüe 4"'),
(gen_random_uuid(), 'f7588d12-8219-4ade-a1af-376fa77e172c', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.10', 'NB 688 - Provisión e instalación tubería PVC 1/2"'),
(gen_random_uuid(), '43159439-ed4c-4f19-b4e0-169fbb444bd2', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.11', 'NB 688 - Provisión e instalación tubería PVC 3/4"'),
(gen_random_uuid(), '209cb0cf-5bce-44fc-904e-77a85e661e95', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '14.12', 'NB 688 - Tanque de agua 1000L'),

-- Chapter 15: Instalaciones Eléctricas (NB-IEL)
(gen_random_uuid(), 'ad2fc6f1-39e9-498e-8ee5-73e1ca1e6b97', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.01', 'NB 777 - Acometida eléctrica'),
(gen_random_uuid(), 'bc99fc1f-fedf-468b-ae06-64017ead3e06', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.02', 'NB 777 - Interruptor termomagnético'),
(gen_random_uuid(), 'ffdd0025-edb0-47ae-bf58-d7e2acc2466e', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.03', 'NB 777 - Luminaria tipo panel LED'),
(gen_random_uuid(), '6e40946e-62df-4b78-833e-ecbaf47c63bb', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.04', 'NB 777 - Puesta a tierra'),
(gen_random_uuid(), 'e4237547-56f2-4040-8d5e-5748ab27f0fc', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.05', 'NB 777 - Punto de iluminación'),
(gen_random_uuid(), '40e36ff7-8537-446a-836f-51a9ebffe41a', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.06', 'NB 777 - Punto de teléfono'),
(gen_random_uuid(), '47bdf434-3e84-42c2-b55e-48b169a9af9d', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.07', 'NB 777 - Punto de tomacorriente'),
(gen_random_uuid(), 'efb067b0-1620-4b42-b6b1-9b8bb33788c6', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.08', 'NB 777 - Punto de tomacorriente especial'),
(gen_random_uuid(), 'a864dc3c-cf11-4751-a12b-26a401e0a795', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.09', 'NB 777 - Punto de TV/datos'),
(gen_random_uuid(), '7bc6f39b-394f-4396-a1e2-a00c049de87a', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '15.10', 'NB 777 - Tablero de distribución'),

-- Chapter 16: Instalaciones de Gas (NB-IGA)
(gen_random_uuid(), '82fe1594-e4c1-48b8-91a9-3516464f4923', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '16.01', 'NB 893 - Detector de gas'),
(gen_random_uuid(), '6fc68fe0-06ba-46e3-9349-623a57a52d9e', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '16.02', 'NB 893 - Llave de paso gas'),
(gen_random_uuid(), 'fa76af68-09af-442b-a6f5-03d28b28a128', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '16.03', 'NB 893 - Punto de gas natural'),
(gen_random_uuid(), '2f10c99b-6dea-47ff-9c92-8f6332abd1b5', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '16.04', 'NB 893 - Tubería de gas 1/2"'),
(gen_random_uuid(), 'e4b2d012-0c90-4c3e-8b8b-b20f2471b0c2', '95e56a90-7d84-4b2a-932e-6a097bdc06f8', '16.05', 'NB 893 - Ventilación de gas');