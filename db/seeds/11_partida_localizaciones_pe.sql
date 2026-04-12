-- Seed file: Partida Localizaciones Perú (RNE Codes)
-- Maps all 111 partidas (same catalog as Bolivia) to Peru RNE codes
-- Uses standard Peruvian budget numbering (XX.XX.XX format)
-- References the relevant RNE norm for each partida
-- Executed after seeds 01-09 and 10_divisiones_pe.sql

INSERT INTO partida_localizaciones (id, partida_id, estandar_id, codigo_local, referencia_norma) VALUES

-- Chapter 01: Obras Provisionales y Preliminares (RNE G.050 Seguridad)
(gen_random_uuid(), 'fc2a6339-c113-402f-bac3-fba63c5cd3a6', (SELECT id FROM estandares WHERE codigo = 'RNE'), '01.01', 'RNE G.050 - Cerco provisional de obra'),
(gen_random_uuid(), '1cb1e1d9-09ad-4938-8bc0-b19c4f0e0aa9', (SELECT id FROM estandares WHERE codigo = 'RNE'), '01.02', 'RNE G.050 - Demoliciones'),
(gen_random_uuid(), 'acb7e34c-6ed3-4094-aa00-3b7cd320961b', (SELECT id FROM estandares WHERE codigo = 'RNE'), '01.03', 'RNE G.050 - Almacén, oficina y caseta de guardianía'),
(gen_random_uuid(), 'ba3fdb89-e4b9-4bde-a4b3-a3e2bcaf7723', (SELECT id FROM estandares WHERE codigo = 'RNE'), '01.04', 'RNE G.050 - Cartel de identificación de obra'),
(gen_random_uuid(), 'f6b66bfc-14f4-4f2d-9f3c-a91a1368cedc', (SELECT id FROM estandares WHERE codigo = 'RNE'), '01.05', 'RNE G.050 - Limpieza de terreno manual'),
(gen_random_uuid(), '11986939-3f8c-4d74-aa06-69aa67372bfa', (SELECT id FROM estandares WHERE codigo = 'RNE'), '01.06', 'RNE G.050 - Trazo, niveles y replanteo'),
(gen_random_uuid(), 'df9fab2a-05e7-46e7-9364-47bfc6ff38a3', (SELECT id FROM estandares WHERE codigo = 'RNE'), '01.07', 'RNE G.050 - Eliminación de material excedente'),

-- Chapter 02: Movimiento de Tierras (RNE E.050 Suelos y Cimentaciones)
(gen_random_uuid(), '7ac9733d-3aa8-4615-a5bc-d71a92c69f5c', (SELECT id FROM estandares WHERE codigo = 'RNE'), '02.01', 'RNE E.050 - Excavación manual hasta 2.00m'),
(gen_random_uuid(), 'fcfaf125-faed-4ee3-ba48-038fde864784', (SELECT id FROM estandares WHERE codigo = 'RNE'), '02.02', 'RNE E.050 - Excavación con maquinaria'),
(gen_random_uuid(), 'ace59a4e-c34b-4dd6-9c97-826299f30548', (SELECT id FROM estandares WHERE codigo = 'RNE'), '02.03', 'RNE E.050 - Nivelación y compactación del terreno'),
(gen_random_uuid(), '51489740-c9ac-486b-8648-f8beb81495ec', (SELECT id FROM estandares WHERE codigo = 'RNE'), '02.04', 'RNE E.050 - Relleno compactado con material propio'),
(gen_random_uuid(), '45bc7672-051c-4727-af71-66b9058d85eb', (SELECT id FROM estandares WHERE codigo = 'RNE'), '02.05', 'RNE E.050 - Relleno con material de préstamo'),
(gen_random_uuid(), 'c594644e-fefd-49cd-a5a3-9b42371ac555', (SELECT id FROM estandares WHERE codigo = 'RNE'), '02.06', 'RNE E.050 - Eliminación de material excedente c/volquete'),

-- Chapter 03: Concreto Simple / Cimentaciones (RNE E.060 Concreto Armado)
(gen_random_uuid(), '818156fc-5622-423e-94b8-3521ca77c8e4', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.01', 'RNE E.060 Art.22 - Cimientos corridos mezcla 1:10 + 30% PG'),
(gen_random_uuid(), '06546589-b90f-4234-8ddd-d65268a821a6', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.02', 'RNE IS.010 - Drenaje de cimentaciones'),
(gen_random_uuid(), 'cdf9bce7-eade-4d81-a41c-028a58eadb52', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.03', 'RNE E.060 - Solado de concreto e=4"'),
(gen_random_uuid(), 'a2819c26-20d7-414d-82a6-3df8ab2f08cd', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.04', 'RNE E.050 - Impermeabilización de cimentaciones'),
(gen_random_uuid(), '67bad6f4-8c6c-4e28-a695-15f9ccfe9ba5', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.05', 'RNE E.060 Art.14 - Muro de contención de concreto armado'),
(gen_random_uuid(), '3d4a46d3-7561-4f1d-a414-cf192f256640', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.06', 'RNE E.060 - Sobrecimiento mezcla 1:8 + 25% PM'),
(gen_random_uuid(), 'e733e0e3-3415-4b8f-b390-dc1bdabb2d83', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.07', 'RNE E.060 - Vigas de cimentación f''c=210 kg/cm²'),
(gen_random_uuid(), '98d6110a-a757-4af2-958b-da8d8a80d985', (SELECT id FROM estandares WHERE codigo = 'RNE'), '03.08', 'RNE E.060 Art.15 - Zapatas f''c=210 kg/cm²'),

-- Chapter 04: Concreto Armado (RNE E.060)
(gen_random_uuid(), 'f9bd8d96-b2ae-4478-be0f-8aaf50d6a65e', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.01', 'RNE E.060 Art.7 - Acero corrugado fy=4200 kg/cm²'),
(gen_random_uuid(), '4f14eaa4-90c6-4214-8e9c-75c8739f0fcc', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.02', 'RNE E.060 Art.10 - Columnas f''c=210 kg/cm²'),
(gen_random_uuid(), '2817e528-8ef1-4512-8189-ff1ca1571625', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.03', 'RNE E.060 Art.5.11 - Curado de concreto'),
(gen_random_uuid(), 'e6b9bff2-fe30-41c2-9a0b-6e9053aee098', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.04', 'RNE E.060 Art.6 - Encofrado y desencofrado de columnas'),
(gen_random_uuid(), '541b62b3-ca7d-4034-93fc-049c89a25583', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.05', 'RNE E.060 Art.6 - Encofrado y desencofrado de losas'),
(gen_random_uuid(), '2660e915-7411-45d6-af33-68befdb7c234', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.06', 'RNE E.060 Art.6 - Encofrado y desencofrado de vigas'),
(gen_random_uuid(), 'd3fdaa59-a320-4da9-99e2-2134c98185be', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.07', 'RNE E.060 - Escaleras f''c=210 kg/cm²'),
(gen_random_uuid(), 'df43910f-ccdc-4f06-aa5e-93274922caf8', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.08', 'RNE E.060 Art.13 - Losa aligerada e=20cm f''c=210 kg/cm²'),
(gen_random_uuid(), '8ba5bfbc-675b-4159-b83b-bbf42697451a', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.09', 'RNE E.060 Art.13 - Losa maciza e=20cm f''c=210 kg/cm²'),
(gen_random_uuid(), 'd5c51b1a-04eb-4738-b70c-98f3e9da19ae', (SELECT id FROM estandares WHERE codigo = 'RNE'), '04.10', 'RNE E.060 Art.11 - Vigas f''c=210 kg/cm²'),

-- Chapter 05: Estructura Metálica (RNE E.090)
(gen_random_uuid(), '0ce55ac8-f34f-4b90-b7c8-b631928202d5', (SELECT id FROM estandares WHERE codigo = 'RNE'), '05.01', 'RNE E.090 - Tijeral metálico'),
(gen_random_uuid(), 'fdf48160-89fa-491f-b347-d9a8b89b90d0', (SELECT id FROM estandares WHERE codigo = 'RNE'), '05.02', 'RNE E.090 - Correas metálicas'),
(gen_random_uuid(), '6b783bb4-bcac-4386-b144-e54e8698da40', (SELECT id FROM estandares WHERE codigo = 'RNE'), '05.03', 'RNE E.090 - Estructura metálica para cobertura'),
(gen_random_uuid(), '23099e62-b528-4070-a96e-54eb3590c73e', (SELECT id FROM estandares WHERE codigo = 'RNE'), '05.04', 'RNE E.090 - Pintura anticorrosiva 2 manos'),

-- Chapter 06: Albañilería / Muros (RNE E.070 Albañilería)
(gen_random_uuid(), '49c98f10-8808-4236-ba65-fe411e1dc09f', (SELECT id FROM estandares WHERE codigo = 'RNE'), '06.01', 'RNE E.070 - Dintel de concreto armado'),
(gen_random_uuid(), 'bf5386fc-68f5-4b79-b769-4f900c93b05d', (SELECT id FROM estandares WHERE codigo = 'RNE'), '06.02', 'RNE E.070 Art.27 - Junta de dilatación en muros'),
(gen_random_uuid(), 'c32a13e0-7801-4bb8-953d-7b37d724d35e', (SELECT id FROM estandares WHERE codigo = 'RNE'), '06.03', 'RNE E.070 Art.28 - Refuerzo horizontal en muros'),
(gen_random_uuid(), 'f08bc6e4-7c9d-42ac-8793-18aa5e2b52cd', (SELECT id FROM estandares WHERE codigo = 'RNE'), '06.04', 'RNE E.070 Art.3 - Muro de ladrillo KK de arcilla soga e=13cm'),
(gen_random_uuid(), '9b9e1e51-2f05-4647-8329-bb74a597cee2', (SELECT id FROM estandares WHERE codigo = 'RNE'), '06.05', 'RNE E.070 Art.3 - Muro de ladrillo KK de arcilla cabeza e=23cm'),
(gen_random_uuid(), 'afe27b73-4c11-4a79-ab03-a3e405efa06f', (SELECT id FROM estandares WHERE codigo = 'RNE'), '06.06', 'RNE E.070 Art.3 - Muro de ladrillo pandereta e=11cm'),
(gen_random_uuid(), '18e8bbae-3f33-4d7e-904b-be808b281064', (SELECT id FROM estandares WHERE codigo = 'RNE'), '06.07', 'RNE E.070 - Tabique de drywall e=12cm'),

-- Chapter 07: Revoques, Enlucidos y Molduras
(gen_random_uuid(), '53d66e93-5180-427e-9129-d3856406e98d', (SELECT id FROM estandares WHERE codigo = 'RNE'), '07.01', 'RNE - Bruñas de 1cm x 1cm'),
(gen_random_uuid(), 'bf7087a8-6495-439b-bbe5-61e0f79ec72c', (SELECT id FROM estandares WHERE codigo = 'RNE'), '07.02', 'RNE - Cielorraso con mezcla C:A 1:5'),
(gen_random_uuid(), 'c3bd88d9-b3d3-4bcb-9bca-63c627ab7ff7', (SELECT id FROM estandares WHERE codigo = 'RNE'), '07.03', 'RNE - Cintas de nivelación'),
(gen_random_uuid(), '71d67fcc-3712-4383-8ae4-76324151808b', (SELECT id FROM estandares WHERE codigo = 'RNE'), '07.04', 'RNE - Tarrajeo de columnas mezcla C:A 1:5'),
(gen_random_uuid(), 'af0f9855-6183-4f84-bb7d-6871b4b867b8', (SELECT id FROM estandares WHERE codigo = 'RNE'), '07.05', 'RNE - Tarrajeo de vigas mezcla C:A 1:5'),
(gen_random_uuid(), '35703195-0ae9-4a3f-9f73-9f11a06b66dc', (SELECT id FROM estandares WHERE codigo = 'RNE'), '07.06', 'RNE - Tarrajeo en exteriores mezcla C:A 1:5'),
(gen_random_uuid(), '66a291d7-7911-45df-a94c-714c97eee4f4', (SELECT id FROM estandares WHERE codigo = 'RNE'), '07.07', 'RNE - Tarrajeo en interiores mezcla C:A 1:5'),

-- Chapter 08: Pisos y Pavimentos
(gen_random_uuid(), '4e0fe119-4bdc-4a37-85e0-c9150f07a433', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.01', 'RNE - Falso piso de concreto e=4"'),
(gen_random_uuid(), '25484f50-b3c6-4708-b5be-cc19cef7c4df', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.02', 'RNE - Contrapiso de 48mm'),
(gen_random_uuid(), '86c0c570-5be2-476c-ab1b-e6a4d77c2e39', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.03', 'RNE - Impermeabilización de pisos'),
(gen_random_uuid(), '9c71f4b8-fdbd-4eb3-ba80-a8db0c3d0dd7', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.04', 'RNE - Junta de dilatación de pisos'),
(gen_random_uuid(), '12555f6a-7c3f-4680-a106-d50c98234d71', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.05', 'RNE - Piso cerámico 30x30cm'),
(gen_random_uuid(), '5c20e9f4-f6ba-40ae-995e-35e492513102', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.06', 'RNE - Piso de cemento pulido e=2"'),
(gen_random_uuid(), '781bec6a-46fe-49b6-aebe-c4c10b88e2b3', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.07', 'RNE - Piso porcelanato 60x60cm'),
(gen_random_uuid(), 'f1bbe530-a9d6-4c32-b8b5-5234b2b5ef15', (SELECT id FROM estandares WHERE codigo = 'RNE'), '08.08', 'RNE - Zócalo cerámico h=10cm'),

-- Chapter 09: Coberturas (Cubiertas)
(gen_random_uuid(), 'cf25e6c8-3e5b-4bce-a8ee-519927dd0c25', (SELECT id FROM estandares WHERE codigo = 'RNE'), '09.01', 'RNE - Botaguas de plancha galvanizada'),
(gen_random_uuid(), '754c4a67-30d8-4ea5-b52a-0a3cdf4e1236', (SELECT id FROM estandares WHERE codigo = 'RNE'), '09.02', 'RNE - Cobertura con calamina galvanizada'),
(gen_random_uuid(), '87ccb235-6e2c-4cde-92c8-50c9f291a8a7', (SELECT id FROM estandares WHERE codigo = 'RNE'), '09.03', 'RNE - Cobertura con teja andina'),
(gen_random_uuid(), '20f95f3c-600c-4bae-8d9b-7b6a04c92943', (SELECT id FROM estandares WHERE codigo = 'RNE'), '09.04', 'RNE - Cumbrera de plancha galvanizada'),
(gen_random_uuid(), 'cc4bcf9a-328c-4142-a21b-03e27f65375d', (SELECT id FROM estandares WHERE codigo = 'RNE'), '09.05', 'RNE - Impermeabilización de cobertura'),
(gen_random_uuid(), '6b0385e4-0b09-4b9d-b62c-f964a8f2fe11', (SELECT id FROM estandares WHERE codigo = 'RNE'), '09.06', 'RNE - Limahoyas de plancha galvanizada'),

-- Chapter 10: Carpintería de Madera
(gen_random_uuid(), '6caf6968-619d-4680-acf0-516ab31485cd', (SELECT id FROM estandares WHERE codigo = 'RNE'), '10.01', 'RNE E.010 - Closet de melanina empotrado'),
(gen_random_uuid(), 'efdf2a6f-9da5-4d67-b0d3-79ad9d071545', (SELECT id FROM estandares WHERE codigo = 'RNE'), '10.02', 'RNE E.010 - Marco de puerta de madera cedro'),
(gen_random_uuid(), '0433a29b-d502-4f9d-b5a4-c5ce84dd6ee5', (SELECT id FROM estandares WHERE codigo = 'RNE'), '10.03', 'RNE - Mueble alto de cocina de melanina'),
(gen_random_uuid(), '3b99a078-64ea-4c79-922b-e32b623ff83c', (SELECT id FROM estandares WHERE codigo = 'RNE'), '10.04', 'RNE - Mueble bajo de cocina de melanina'),
(gen_random_uuid(), '6535279a-c63e-42eb-912a-09fb529557d8', (SELECT id FROM estandares WHERE codigo = 'RNE'), '10.05', 'RNE E.010 - Puerta de closet contraplacada'),
(gen_random_uuid(), '862a8bc9-308a-4bcc-b1b6-6d3cc2a0a2fc', (SELECT id FROM estandares WHERE codigo = 'RNE'), '10.06', 'RNE E.010 - Puerta contraplacada interior 35mm'),
(gen_random_uuid(), '2fb2a673-834c-437e-8c5d-eeafc602ec78', (SELECT id FROM estandares WHERE codigo = 'RNE'), '10.07', 'RNE E.010 - Puerta principal de madera cedro'),

-- Chapter 11: Carpintería Metálica
(gen_random_uuid(), '5ed4672a-98bd-440c-977f-d4ef71335981', (SELECT id FROM estandares WHERE codigo = 'RNE'), '11.01', 'RNE E.090 - Baranda metálica de tubo galvanizado'),
(gen_random_uuid(), 'e00bc924-897b-4827-af7e-865bd467374d', (SELECT id FROM estandares WHERE codigo = 'RNE'), '11.02', 'RNE E.090 - Escalera tipo gato de fierro'),
(gen_random_uuid(), '57bcd4f0-3ef6-4f2b-88ea-13a5f5fe09c8', (SELECT id FROM estandares WHERE codigo = 'RNE'), '11.03', 'RNE E.090 - Pasamanos metálico de tubo 2"'),
(gen_random_uuid(), '9d495484-4bad-4e9e-b45d-a2078ad6db7a', (SELECT id FROM estandares WHERE codigo = 'RNE'), '11.04', 'RNE - Puerta metálica de plancha 1/16"'),
(gen_random_uuid(), '9c7e7dff-a4f3-4a6f-8370-8c50ee524c6a', (SELECT id FROM estandares WHERE codigo = 'RNE'), '11.05', 'RNE - Reja de seguridad de fierro'),
(gen_random_uuid(), '68d5b2e4-9d97-4a63-9856-3327e234490a', (SELECT id FROM estandares WHERE codigo = 'RNE'), '11.06', 'RNE - Ventana de aluminio con vidrio'),

-- Chapter 12: Pintura
(gen_random_uuid(), '9c6ff68b-fb78-4fc8-8db6-e934cf9df7bb', (SELECT id FROM estandares WHERE codigo = 'RNE'), '12.01', 'RNE - Pintura al óleo mate en puertas'),
(gen_random_uuid(), 'a480378f-b0e0-427c-b6ea-38290112e830', (SELECT id FROM estandares WHERE codigo = 'RNE'), '12.02', 'RNE - Pintura anticorrosiva 2 manos'),
(gen_random_uuid(), '0f862347-2f1f-4507-a43d-41d0546a8343', (SELECT id FROM estandares WHERE codigo = 'RNE'), '12.03', 'RNE - Pintura látex en exteriores 2 manos'),
(gen_random_uuid(), '5070f9b9-91fd-4890-98b1-f523876c466f', (SELECT id FROM estandares WHERE codigo = 'RNE'), '12.04', 'RNE - Pintura látex en interiores 2 manos'),
(gen_random_uuid(), '01eb638d-321f-4a37-a09b-0f710f1ae087', (SELECT id FROM estandares WHERE codigo = 'RNE'), '12.05', 'RNE - Imprimante para muros'),

-- Chapter 13: Vidrios, Cristales y Similares
(gen_random_uuid(), '5894fb96-b84a-4ce0-8690-9a1c3e0f349d', (SELECT id FROM estandares WHERE codigo = 'RNE'), '13.01', 'RNE - Espejo biselado e=4mm'),
(gen_random_uuid(), 'e24c9d01-c406-4edf-8107-b5f1a43c3734', (SELECT id FROM estandares WHERE codigo = 'RNE'), '13.02', 'RNE - Vidrio laminado incoloro'),
(gen_random_uuid(), '4439a584-5c57-43ef-afb6-e1a6028a130d', (SELECT id FROM estandares WHERE codigo = 'RNE'), '13.03', 'RNE - Vidrio templado incoloro e=6mm'),

-- Chapter 14: Instalaciones Sanitarias (RNE IS.010)
(gen_random_uuid(), '0f8352c1-1e09-4c47-a02e-da412b32dd86', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.01', 'RNE IS.010 - Equipo de bombeo de agua'),
(gen_random_uuid(), 'acc79ed4-f6dd-48ee-b4d0-ca6c5b147831', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.02', 'RNE IS.010 - Terma a gas de 10 litros'),
(gen_random_uuid(), '55b23349-3328-481a-a0cf-a2049eee96d7', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.03', 'RNE IS.010 - Caja de registro de desagüe 12"x24"'),
(gen_random_uuid(), '8973f47b-bc7a-4a73-9c0b-c4134af9841e', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.04', 'RNE IS.010 - Ducha cromada con grifería mezcladora'),
(gen_random_uuid(), '31610e09-f5c8-4751-9f2b-6ac116b26fb6', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.05', 'RNE IS.010 - Inodoro tanque bajo losa vitrificada'),
(gen_random_uuid(), 'd9b20005-efe3-4dad-af72-857ccc6c7011', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.06', 'RNE IS.010 - Lavatorio de losa vitrificada c/pedestal'),
(gen_random_uuid(), 'eba18f66-f943-4e59-ba1f-293293ee6225', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.07', 'RNE IS.010 - Lavadero de acero inoxidable'),
(gen_random_uuid(), '555fad17-40e8-40f4-bcdd-956be059b1f0', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.08', 'RNE IS.010 - Tubería PVC-SAL 2" desagüe'),
(gen_random_uuid(), '4d1a0e21-7020-42d0-9cf5-a08366d6c9e6', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.09', 'RNE IS.010 - Tubería PVC-SAL 4" desagüe'),
(gen_random_uuid(), 'f7588d12-8219-4ade-a1af-376fa77e172c', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.10', 'RNE IS.010 - Tubería PVC-SAP C-10 1/2" agua fría'),
(gen_random_uuid(), '43159439-ed4c-4f19-b4e0-169fbb444bd2', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.11', 'RNE IS.010 - Tubería PVC-SAP C-10 3/4" agua fría'),
(gen_random_uuid(), '209cb0cf-5bce-44fc-904e-77a85e661e95', (SELECT id FROM estandares WHERE codigo = 'RNE'), '14.12', 'RNE IS.010 - Tanque elevado de polietileno 1100L'),

-- Chapter 15: Instalaciones Eléctricas (RNE EM.010)
(gen_random_uuid(), 'ad2fc6f1-39e9-498e-8ee5-73e1ca1e6b97', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.01', 'RNE EM.010 - Acometida eléctrica'),
(gen_random_uuid(), 'bc99fc1f-fedf-468b-ae06-64017ead3e06', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.02', 'RNE EM.010 - Interruptor termomagnético'),
(gen_random_uuid(), 'ffdd0025-edb0-47ae-bf58-d7e2acc2466e', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.03', 'RNE EM.010 - Luminaria tipo panel LED empotrado'),
(gen_random_uuid(), '6e40946e-62df-4b78-833e-ecbaf47c63bb', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.04', 'RNE EM.010 - Pozo de puesta a tierra'),
(gen_random_uuid(), 'e4237547-56f2-4040-8d5e-5748ab27f0fc', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.05', 'RNE EM.010 - Salida de techo (centro de luz)'),
(gen_random_uuid(), '40e36ff7-8537-446a-836f-51a9ebffe41a', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.06', 'RNE EM.010 - Salida para teléfono'),
(gen_random_uuid(), '47bdf434-3e84-42c2-b55e-48b169a9af9d', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.07', 'RNE EM.010 - Salida para tomacorriente bipolar simple'),
(gen_random_uuid(), 'efb067b0-1620-4b42-b6b1-9b8bb33788c6', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.08', 'RNE EM.010 - Salida para tomacorriente c/línea a tierra'),
(gen_random_uuid(), 'a864dc3c-cf11-4751-a12b-26a401e0a795', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.09', 'RNE EM.010 - Salida para TV cable/datos'),
(gen_random_uuid(), '7bc6f39b-394f-4396-a1e2-a00c049de87a', (SELECT id FROM estandares WHERE codigo = 'RNE'), '15.10', 'RNE EM.010 - Tablero de distribución TD-01'),

-- Chapter 16: Instalaciones de Gas (RNE EM.040)
(gen_random_uuid(), '82fe1594-e4c1-48b8-91a9-3516464f4923', (SELECT id FROM estandares WHERE codigo = 'RNE'), '16.01', 'RNE EM.040 - Detector de gas natural'),
(gen_random_uuid(), '6fc68fe0-06ba-46e3-9349-623a57a52d9e', (SELECT id FROM estandares WHERE codigo = 'RNE'), '16.02', 'RNE EM.040 - Válvula de paso de gas 1/2"'),
(gen_random_uuid(), 'fa76af68-09af-442b-a6f5-03d28b28a128', (SELECT id FROM estandares WHERE codigo = 'RNE'), '16.03', 'RNE EM.040 - Punto de salida de gas natural'),
(gen_random_uuid(), '2f10c99b-6dea-47ff-9c92-8f6332abd1b5', (SELECT id FROM estandares WHERE codigo = 'RNE'), '16.04', 'RNE EM.040 - Tubería de cobre 1/2" para gas'),
(gen_random_uuid(), 'e4b2d012-0c90-4c3e-8b8b-b20f2471b0c2', (SELECT id FROM estandares WHERE codigo = 'RNE'), '16.05', 'RNE EM.040 - Ventilación de ambiente con gas');
